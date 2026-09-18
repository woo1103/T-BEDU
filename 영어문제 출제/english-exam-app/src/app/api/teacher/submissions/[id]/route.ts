import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { correctLabel } from "@/lib/grading";
import { areaNamesForAnswers, computeBreakdown } from "@/lib/achievement";

function isWritingType(t: string) {
  return t.startsWith("naesin_writing");
}

// 제출 1건 로드 (답안 + 과제 문항 메타)
function loadSubmission(id: string) {
  return prisma.submission.findUnique({
    where: { id },
    include: {
      answers: true,
      assignment: {
        include: {
          assessment: {
            include: {
              exam: {
                include: {
                  items: {
                    include: { question: true },
                    orderBy: { orderNum: "asc" },
                  },
                },
              },
              worksheet: { include: { items: { orderBy: { number: "asc" } } } },
            },
          },
        },
      },
    },
  });
}

type Sub = NonNullable<Awaited<ReturnType<typeof loadSubmission>>>;

interface Meta {
  label: string;
  order: number;
  correct: string;
  maxPoints: number;
  writing: boolean;
  question?: string;
}

function metaByRef(sub: Sub): Map<string, Meta> {
  const map = new Map<string, Meta>();
  const a = sub.assignment.assessment;
  if (a.type === "worksheet") {
    for (const it of a.worksheet?.items ?? []) {
      map.set(it.id, {
        label: `${it.number}번`,
        order: it.number,
        correct: it.answer,
        maxPoints: it.points,
        writing: false,
      });
    }
  } else {
    for (const item of a.exam?.items ?? []) {
      const q = item.question;
      const writing = isWritingType(q.questionType);
      map.set(q.id, {
        label: `${item.orderNum}번`,
        order: item.orderNum,
        correct: writing ? "" : correctLabel(q) ?? "",
        maxPoints: item.customPoints ?? q.points,
        writing,
        question: q.question,
      });
    }
  }
  return map;
}

// 교사: 제출 상세(문항별 채점 현황) 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const sub = await loadSubmission(id);
  if (!sub) {
    return NextResponse.json({ error: "제출을 찾을 수 없습니다" }, { status: 404 });
  }
  const metas = metaByRef(sub);
  const items = sub.answers
    .map((ans) => {
      const m = metas.get(ans.refId);
      return {
        answerId: ans.id,
        label: m?.label ?? "-",
        order: m?.order ?? 0,
        selected: ans.selected,
        correct: m?.correct ?? "",
        isCorrect: ans.isCorrect,
        points: ans.points,
        maxPoints: m?.maxPoints ?? 0,
        writing: m?.writing ?? false,
        feedback: ans.feedback,
        question: m?.question ?? "",
      };
    })
    .sort((x, y) => x.order - y.order);

  return NextResponse.json({
    submission: {
      id: sub.id,
      title: sub.assignment.title,
      score: sub.score,
      totalPoints: sub.totalPoints,
      correctCount: sub.correctCount,
      itemCount: sub.itemCount,
      submittedAt: sub.submittedAt,
    },
    items,
  });
}

// 교사: 문항별 채점 수동 정정
// body: { items: [{ answerId, isCorrect, points, feedback? }] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const sub = await loadSubmission(id);
  if (!sub) {
    return NextResponse.json({ error: "제출을 찾을 수 없습니다" }, { status: 404 });
  }
  const metas = metaByRef(sub);
  const answerById = new Map(sub.answers.map((a) => [a.id, a]));

  // 편집 적용
  for (const edit of body.items) {
    const ans = answerById.get(edit.answerId);
    if (!ans) continue;
    const m = metas.get(ans.refId);
    const maxPoints = m?.maxPoints ?? 0;
    let points = Number(edit.points);
    if (!Number.isFinite(points)) points = ans.points;
    points = Math.max(0, Math.min(maxPoints, Math.round(points)));
    const isCorrect = edit.isCorrect === true;
    const feedback =
      typeof edit.feedback === "string" ? edit.feedback : ans.feedback;

    await prisma.answer.update({
      where: { id: ans.id },
      data: { isCorrect, points, feedback },
    });

    // 오답노트 동기화
    if (isCorrect) {
      await prisma.wrongNote.deleteMany({ where: { answerId: ans.id } });
    } else {
      const exists = await prisma.wrongNote.findFirst({
        where: { answerId: ans.id },
      });
      if (!exists) {
        await prisma.wrongNote.create({
          data: { studentId: sub.studentId, answerId: ans.id },
        });
      }
    }
  }

  // 재집계
  const fresh = await prisma.answer.findMany({
    where: { submissionId: sub.id },
  });
  const score = fresh.reduce((s, a) => s + a.points, 0);
  const correctCount = fresh.filter((a) => a.isCorrect).length;
  await prisma.submission.update({
    where: { id: sub.id },
    data: { score, correctCount },
  });

  // 성취도 스냅샷 갱신
  const areaMap = await areaNamesForAnswers(
    fresh.map((a) => ({ refId: a.refId, refType: a.refType }))
  );
  const breakdown = computeBreakdown(
    fresh.map((a) => ({ refId: a.refId, isCorrect: a.isCorrect })),
    areaMap
  );
  await prisma.achievementSnapshot.updateMany({
    where: { submissionId: sub.id },
    data: {
      overallRate: breakdown.overall.rate,
      byArea: JSON.stringify(breakdown.areas),
    },
  });

  return NextResponse.json({
    success: true,
    score,
    correctCount,
    totalPoints: sub.totalPoints,
    rate: sub.totalPoints > 0 ? Math.round((score / sub.totalPoints) * 100) : 0,
  });
}
