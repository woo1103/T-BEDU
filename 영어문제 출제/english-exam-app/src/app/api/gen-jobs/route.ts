import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { canGenerateWithAi, getQuestionTypeInfo, EXAM_TYPE_MAP } from "@/lib/question-types";
import { isStalled, kickJob, summarizeItems, type JobSettings } from "@/lib/gen-jobs";

const MAX_ITEMS = 60;

// 내 생성 작업 목록(관리자는 전체). 멈춘 작업은 다시 깨운다.
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const jobs = await prisma.genJob.findMany({
    where: staff.role === "admin" ? {} : { createdById: staff.sub },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { items: { select: { status: true } } },
  });
  const origin = request.nextUrl.origin;
  const stalled = jobs.filter(isStalled);
  if (stalled.length) after(() => Promise.all(stalled.map((j) => kickJob(origin, j.id))));

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      createdAt: j.createdAt,
      ...summarizeItems(j.items),
    })),
  });
}

interface ItemInput {
  questionType: string;
  count: number;
  passageId?: string;
  sourceText?: string;
}

// 작업 만들기: 유형·개수(지문별)를 받아 문항 단위로 쪼개 저장하고 바로 시작한다.
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const examType = body?.examType;
  const inputs: ItemInput[] = Array.isArray(body?.items) ? body.items : [];
  if (typeof examType !== "string" || !(examType in EXAM_TYPE_MAP) || inputs.length === 0) {
    return NextResponse.json({ error: "시험 유형과 문제 유형을 골라 주세요." }, { status: 400 });
  }

  const rows: { questionType: string; passageId: string | null; sourceText: string | null }[] = [];
  for (const it of inputs) {
    if (typeof it?.questionType !== "string" || !canGenerateWithAi(examType, it.questionType)) {
      return NextResponse.json({ error: `AI로 만들 수 없는 유형이에요: ${it?.questionType}` }, { status: 400 });
    }
    const n = Math.max(1, Math.min(MAX_ITEMS, Math.floor(Number(it.count) || 1)));
    for (let i = 0; i < n; i++) {
      rows.push({
        questionType: it.questionType,
        passageId: typeof it.passageId === "string" ? it.passageId : null,
        sourceText: typeof it.sourceText === "string" && it.sourceText.trim() ? it.sourceText : null,
      });
    }
  }
  if (rows.length > MAX_ITEMS) {
    return NextResponse.json({ error: `한 번에 ${MAX_ITEMS}문항까지 맡길 수 있어요(지금 ${rows.length}문항).` }, { status: 400 });
  }

  const settings: JobSettings = {
    difficulty: typeof body.difficulty === "string" ? body.difficulty : "medium",
    topic: typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : undefined,
    passageMode: typeof body.passageMode === "string" ? body.passageMode : undefined,
    variations: Array.isArray(body.variations) ? body.variations.filter((v: unknown) => typeof v === "string") : undefined,
  };
  const typeNames = [...new Set(rows.map((r) => getQuestionTypeInfo(examType, r.questionType)?.name ?? r.questionType))];
  const examName = EXAM_TYPE_MAP[examType as keyof typeof EXAM_TYPE_MAP].name;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : `${examName} ${typeNames[0]}${typeNames.length > 1 ? ` 외 ${typeNames.length - 1}유형` : ""} ${rows.length}문항`;

  const job = await prisma.genJob.create({
    data: {
      createdById: staff.sub,
      title,
      examType,
      settings: JSON.stringify(settings),
      items: { create: rows.map((r, i) => ({ ...r, order: i })) },
    },
  });

  const origin = request.nextUrl.origin;
  after(() => kickJob(origin, job.id));
  return NextResponse.json({ id: job.id, total: rows.length }, { status: 201 });
}
