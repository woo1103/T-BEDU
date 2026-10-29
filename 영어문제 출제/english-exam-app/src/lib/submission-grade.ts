// 과제 채점·저장(학생 앱 제출과 선생님의 종이 답 입력이 같은 규칙을 쓴다)
import { prisma } from "@/lib/db";
import { correctLabel, isAnswerCorrect } from "@/lib/grading";
import { gradeWritingAnswer } from "@/lib/claude";
import { areaNamesForAnswers, computeBreakdown } from "@/lib/achievement";

interface AnswerRow {
  refType: string;
  refId: string;
  selected: string;
  isCorrect: boolean;
  points: number;
  feedback?: string | null;
}

// 응답용 문항별 결과(맞음/틀림/정답/획득점수/피드백)
export interface ResultItem {
  refId: string;
  label: string;
  order: number;
  selected: string;
  correct: string; // 표시용 정답(서술형은 "")
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  writing: boolean;
  feedback: string | null;
}

// 서술형(주관식) 유형 판별
function isWritingType(questionType: string): boolean {
  return questionType.startsWith("naesin_writing");
}

export type AssignmentWithItems = NonNullable<
  Awaited<ReturnType<typeof loadAssignment>>
>;

export function loadAssignment(assignmentId: string) {
  return prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      assessment: {
        include: {
          exam: {
            include: {
              items: { include: { question: true }, orderBy: { orderNum: "asc" } },
            },
          },
          worksheet: { include: { items: { orderBy: { number: "asc" } } } },
        },
      },
    },
  });
}

// 문항 메타(공통): 정답·배점·표시라벨
export interface Meta {
  refId: string;
  refType: string;
  label: string;
  order: number;
  correct: string;
  maxPoints: number;
  writing: boolean;
  choice: boolean; // 번호로 고르는 객관식(종이 답 입력에서 숫자 한 글자로 받는다)
}

export function buildMetas(assignment: AssignmentWithItems): Meta[] {
  if (assignment.assessment.type === "worksheet") {
    const items = assignment.assessment.worksheet?.items ?? [];
    return items.map((it) => ({
      refId: it.id,
      refType: "worksheet_item",
      label: `${it.number}번`,
      order: it.number,
      correct: it.answer,
      maxPoints: it.points,
      writing: false,
      choice: it.choicesCount != null,
    }));
  }
  const items = assignment.assessment.exam?.items ?? [];
  return items.map((item) => {
    const q = item.question;
    const writing = isWritingType(q.questionType);
    return {
      refId: q.id,
      refType: "question",
      label: `${item.orderNum}번`,
      order: item.orderNum,
      correct: writing ? "" : correctLabel(q) ?? "",
      maxPoints: item.customPoints ?? q.points,
      writing,
      choice: !writing,
    };
  });
}

// 저장된 채점 결과(제출본)를 문항별 결과로 재구성 (재채점 없이 조회용)
export function reconstructResults(
  metas: Meta[],
  answers: {
    refId: string;
    selected: string;
    isCorrect: boolean;
    points: number;
    feedback: string | null;
  }[]
): ResultItem[] {
  const byRef = new Map(answers.map((a) => [a.refId, a]));
  return metas.map((m) => {
    const a = byRef.get(m.refId);
    return {
      refId: m.refId,
      label: m.label,
      order: m.order,
      selected: a?.selected ?? "",
      correct: m.correct,
      isCorrect: a?.isCorrect ?? false,
      points: a?.points ?? 0,
      maxPoints: m.maxPoints,
      writing: m.writing,
      feedback: a?.feedback ?? null,
    };
  });
}

export function resultPayload(
  submission: {
    id: string;
    score: number;
    totalPoints: number;
    correctCount: number;
    itemCount: number;
  },
  results: ResultItem[],
  alreadySubmitted: boolean
) {
  return {
    submissionId: submission.id,
    score: submission.score,
    totalPoints: submission.totalPoints,
    correctCount: submission.correctCount,
    itemCount: submission.itemCount,
    rate:
      submission.totalPoints > 0
        ? Math.round((submission.score / submission.totalPoints) * 100)
        : 0,
    results,
    alreadySubmitted,
  };
}

// 답을 채점해 제출 기록·성취도·오답노트를 남긴다.
// selectedByRef: 문항 refId → 고른 답, writingPoints: 서술형을 선생님이 직접 매긴 점수(있으면 AI 채점 생략)
export async function gradeAndSave(
  assignment: AssignmentWithItems,
  studentId: string,
  selectedByRef: Map<string, string>,
  opts: { writingPoints?: Map<string, number> } = {}
) {
  const metas = buildMetas(assignment);

  // 서술형 AI 채점을 위해 문항 원본 매핑(exam)
  const questionByRef = new Map(
    (assignment.assessment.exam?.items ?? []).map((it) => [it.question.id, it.question])
  );

  let score = 0;
  let totalPoints = 0;
  let correctCount = 0;
  const answerRows: AnswerRow[] = [];
  const results: ResultItem[] = [];

  for (const meta of metas) {
    totalPoints += meta.maxPoints;
    const selected = (selectedByRef.get(meta.refId) ?? "").trim();
    let isCorrect = false;
    let points = 0;
    let feedback: string | null = null;

    const manual = opts.writingPoints?.get(meta.refId);
    if (meta.writing && manual !== undefined) {
      // 종이 시험: 선생님이 매긴 점수를 그대로 쓴다(AI 채점 안 함)
      points = Math.max(0, Math.min(meta.maxPoints, Math.round(manual)));
      feedback = "선생님 채점";
      isCorrect = meta.maxPoints > 0 && points >= Math.ceil(meta.maxPoints * 0.6);
    } else if (meta.writing) {
      const q = questionByRef.get(meta.refId);
      if (selected === "") {
        feedback = "답안이 제출되지 않았습니다.";
      } else if (q) {
        try {
          const graded = await gradeWritingAnswer({
            question: q.question,
            passage: q.passage,
            modelAnswer: q.answer,
            rubric: q.explanation ?? undefined,
            studentAnswer: selected,
            maxPoints: meta.maxPoints,
          });
          points = graded.awardedPoints;
          feedback = graded.feedback;
        } catch {
          points = 0;
          feedback = "자동 채점에 실패했습니다. 담당 선생님의 확인이 필요합니다.";
        }
      }
      // 만점의 60% 이상이면 정답으로 간주(성취도/오답노트 기준)
      isCorrect = meta.maxPoints > 0 && points >= Math.ceil(meta.maxPoints * 0.6);
    } else {
      // 객관식/단답: 문제지 기준 정답 라벨과 정규화 비교
      isCorrect = isAnswerCorrect(selected, meta.correct);
      points = isCorrect ? meta.maxPoints : 0;
    }

    score += points;
    if (isCorrect) correctCount++;
    answerRows.push({
      refType: meta.refType,
      refId: meta.refId,
      selected,
      isCorrect,
      points,
      feedback,
    });
    results.push({
      refId: meta.refId,
      label: meta.label,
      order: meta.order,
      selected,
      correct: meta.correct,
      isCorrect,
      points,
      maxPoints: meta.maxPoints,
      writing: meta.writing,
      feedback,
    });
  }

  const submission = await prisma.submission.create({
    data: {
      studentId: studentId,
      assignmentId: assignment.id,
      submittedAt: new Date(),
      status: "graded",
      score,
      totalPoints,
      correctCount,
      itemCount: answerRows.length,
      answers: { create: answerRows },
    },
  });

  // 성취도 스냅샷
  const areaMap = await areaNamesForAnswers(
    answerRows.map((r) => ({ refId: r.refId, refType: r.refType }))
  );
  const breakdown = computeBreakdown(
    answerRows.map((r) => ({ refId: r.refId, isCorrect: r.isCorrect })),
    areaMap
  );
  await prisma.achievementSnapshot.create({
    data: {
      studentId: studentId,
      submissionId: submission.id,
      subject: assignment.assessment.subject,
      overallRate: breakdown.overall.rate,
      byArea: JSON.stringify(breakdown.areas),
    },
  });

  // 오답노트 자동 생성
  const wrongAnswers = await prisma.answer.findMany({
    where: { submissionId: submission.id, isCorrect: false },
    select: { id: true },
  });
  if (wrongAnswers.length > 0) {
    await prisma.wrongNote.createMany({
      data: wrongAnswers.map((a) => ({
        studentId: studentId,
        answerId: a.id,
      })),
    });
  }

  return resultPayload(submission, results, false);
}
