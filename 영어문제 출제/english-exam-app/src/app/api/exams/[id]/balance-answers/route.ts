import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { isWritingType, isMarkerOnlyChoices, normalizeMarkerChoices } from "@/lib/passage-parser";
import { isMarkerMappedType } from "@/lib/question-validate";
import { LABELS, distribution, isSkewed, moveCorrect, planBalance } from "@/lib/answer-balance";

// 시험지 정답 번호 분포(GET)와 고르게 섞기(POST).
// 섞기는 다른 시험지·제출 기록에 영향이 없도록, 아직 배정 안 된 시험지에서 이 시험지에만 쓰이는 문항의
// 선지 순서만 바꾼다. 지문 마커와 연결된 선지(어법·순서·삽입 등)는 바꾸지 않는다.

interface Choice {
  label?: string;
  text?: string;
  isCorrect?: boolean;
}

async function analyze(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      assessments: { select: { _count: { select: { assignments: true } } } },
      items: {
        orderBy: { orderNum: "asc" },
        select: {
          question: {
            select: {
              id: true,
              questionType: true,
              choices: true,
              _count: { select: { examItems: true } },
            },
          },
        },
      },
    },
  });
  if (!exam) return null;
  const assigned = exam.assessments.some((a) => a._count.assignments > 0);

  const rows: { id: string; raw: Choice[]; pos: number; movable: boolean }[] = [];
  for (const { question: q } of exam.items) {
    if (isWritingType(q.questionType)) continue;
    let raw: Choice[];
    try {
      raw = JSON.parse(q.choices) as Choice[];
    } catch {
      continue;
    }
    if (!Array.isArray(raw)) continue;
    const norm = normalizeMarkerChoices(raw.map((c, i) => ({ label: c.label ?? LABELS[i] ?? "", text: c.text ?? "", isCorrect: !!c.isCorrect })));
    const pos = norm.findIndex((c) => c.isCorrect);
    if (pos < 0 || norm.filter((c) => c.isCorrect).length !== 1) continue;
    const movable =
      !assigned &&
      q._count.examItems === 1 &&
      raw.length === 5 &&
      !isMarkerMappedType(q.questionType) &&
      !isMarkerOnlyChoices(norm);
    rows.push({ id: q.id, raw, pos, movable });
  }
  return { assigned, rows };
}

function summary(positions: number[], movableCount: number, assigned: boolean) {
  const dist = distribution(positions);
  return { distribution: dist, skewed: isSkewed(dist), movableCount, assigned, total: positions.length };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const a = await analyze(id);
  if (!a) return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 404 });
  return NextResponse.json(
    summary(a.rows.map((r) => r.pos), a.rows.filter((r) => r.movable).length, a.assigned)
  );
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const a = await analyze(id);
  if (!a) return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 404 });
  if (a.assigned) {
    return NextResponse.json({ error: "이미 학생에게 배정된 시험지는 선지 순서를 바꿀 수 없어요." }, { status: 409 });
  }

  const before = a.rows.map((r) => r.pos);
  const after = planBalance(before, a.rows.map((r) => r.movable));
  const updates = a.rows
    .map((r, i) => ({ r, from: before[i], to: after[i] }))
    .filter((u) => u.from !== u.to)
    .map(({ r, from, to }) => {
      const moved = moveCorrect(r.raw, from, to).map((c, k) => ({ ...c, label: LABELS[k] }));
      return prisma.question.update({
        where: { id: r.id },
        data: { choices: JSON.stringify(moved), answer: LABELS[to] },
      });
    });
  if (updates.length > 0) await prisma.$transaction(updates);

  return NextResponse.json({
    changed: updates.length,
    ...summary(after, a.rows.filter((r) => r.movable).length, false),
  });
}
