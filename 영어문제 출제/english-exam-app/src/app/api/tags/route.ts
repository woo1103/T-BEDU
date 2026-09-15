import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { ENGLISH_AREAS } from "@/lib/english-areas";

const VALID_KINDS = ["영역", "단원", "개념"];

// 영어 능력영역 초기 6종 시드 (없을 때만)
async function ensureEnglishAreas() {
  const count = await prisma.tag.count({
    where: { subject: "english", kind: "영역" },
  });
  if (count > 0) return;
  for (const name of ENGLISH_AREAS) {
    await prisma.tag
      .create({ data: { subject: "english", kind: "영역", name } })
      .catch(() => {});
  }
}

export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  await ensureEnglishAreas();

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");

  const tags = await prisma.tag.findMany({
    where: subject ? { subject } : {},
    include: { _count: { select: { questionTags: true } } },
    orderBy: [{ subject: "asc" }, { kind: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ tags });
}

export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.subject || !body?.name) {
    return NextResponse.json(
      { error: "과목과 태그 이름은 필수입니다" },
      { status: 400 }
    );
  }
  const kind = VALID_KINDS.includes(body.kind) ? body.kind : "영역";

  try {
    const tag = await prisma.tag.create({
      data: {
        subject: body.subject,
        kind,
        name: String(body.name).trim(),
        parentId: body.parentId || null,
      },
    });
    return NextResponse.json({ tag }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "이미 존재하는 태그입니다" },
      { status: 409 }
    );
  }
}
