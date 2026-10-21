import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import {
  validateStoredQuestion,
  isMarkerMappedType,
  reconcileCorrect,
  validateSingleAnswer,
  type ValChoice,
} from "@/lib/question-validate";
import { isWritingType } from "@/lib/passage-parser";

const CIRCLE = ["①", "②", "③", "④", "⑤"];

// 객관식인데 정답 표시가 없거나 여러 개인 문항. answer 필드로 복구 가능한지 함께 판정한다.
async function scanAnswerless() {
  const questions = await prisma.question.findMany({
    select: { id: true, questionType: true, choices: true, answer: true },
  });
  const list: { id: string; fixed: ValChoice[] | null }[] = [];
  for (const q of questions) {
    if (isWritingType(q.questionType)) continue;
    let choices: ValChoice[];
    try {
      choices = JSON.parse(q.choices) as ValChoice[];
    } catch {
      continue; // JSON 자체가 깨진 건 구조 검사 쪽 소관
    }
    if (!Array.isArray(choices) || validateSingleAnswer(choices).ok) continue;
    const repaired = reconcileCorrect(choices, q.answer);
    list.push({ id: q.id, fixed: validateSingleAnswer(repaired).ok ? repaired : null });
  }
  return list;
}

// 구조가 깨진 문항(어법/순서/삽입 마커·선지·정답 불일치)을 스캔한다.
async function scanBroken() {
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      questionType: true,
      passage: true,
      choices: true,
      answer: true,
      question: true,
    },
  });
  const broken: {
    id: string;
    questionType: string;
    reason: string;
    question: string;
    inExams: number;
  }[] = [];
  for (const q of questions) {
    if (!isMarkerMappedType(q.questionType)) continue;
    const v = validateStoredQuestion(q);
    if (!v.ok) {
      const inExams = await prisma.examItem.count({ where: { questionId: q.id } });
      broken.push({
        id: q.id,
        questionType: q.questionType,
        reason: v.reason ?? "구조 오류",
        question: q.question.slice(0, 60),
        inExams,
      });
    }
  }
  return broken;
}

// 검사(삭제 안 함): 깨진 문항 목록/개수
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const broken = await scanBroken();
  const answerless = await scanAnswerless();
  return NextResponse.json({
    count: broken.length,
    broken,
    answerless: {
      count: answerless.length,
      fixable: answerless.filter((a) => a.fixed).length,
    },
  });
}

// 정답 표시 복구(삭제 없음): answer 필드로 정답 1개를 확정할 수 있는 문항만 고친다.
export async function PATCH() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const answerless = await scanAnswerless();
  let repaired = 0;
  for (const a of answerless) {
    if (!a.fixed) continue;
    const idx = a.fixed.findIndex((c) => c.isCorrect);
    await prisma.question.update({
      where: { id: a.id },
      data: { choices: JSON.stringify(a.fixed), answer: CIRCLE[idx] ?? String(idx + 1) },
    });
    repaired++;
  }
  return NextResponse.json({ repaired, unfixable: answerless.length - repaired });
}

// 정리(삭제): 깨진 문항을 삭제. 시험지에 배치된 것은 배치(ExamItem) 제거 후 삭제.
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "confirm 필요" }, { status: 400 });
  }

  const broken = await scanBroken();
  const ids = broken.map((b) => b.id);
  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0, removedFromExams: 0 });
  }

  const removedFromExams = await prisma.examItem.deleteMany({
    where: { questionId: { in: ids } },
  });
  // 오답노트/제출 답안은 refId로만 참조(FK 아님)하므로 문항 삭제에 영향 없음
  const deleted = await prisma.question.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    deleted: deleted.count,
    removedFromExams: removedFromExams.count,
  });
}
