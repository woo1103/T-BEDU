import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
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
interface ResultItem {
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

type AssignmentWithItems = NonNullable<
  Awaited<ReturnType<typeof loadAssignment>>
>;

function loadAssignment(assignmentId: string) {
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
interface Meta {
  refId: string;
  refType: string;
  label: string;
  order: number;
  correct: string;
  maxPoints: number;
  writing: boolean;
}

function buildMetas(assignment: AssignmentWithItems): Meta[] {
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
    };
  });
}

// 저장된 채점 결과(제출본)를 문항별 결과로 재구성 (재채점 없이 조회용)
function reconstructResults(
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

function resultPayload(
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

// 이미 제출한 과제의 결과 조회 (재채점 없이). GET ?assignmentId=
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const assignmentId = new URL(request.url).searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId가 필요합니다" }, { status: 400 });
  }
  const assignment = await loadAssignment(assignmentId);
  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  }
  const submission = await prisma.submission.findFirst({
    where: { studentId: student.studentId, assignmentId },
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
  if (!submission) {
    return NextResponse.json({ submitted: false });
  }
  const metas = buildMetas(assignment);
  const results = reconstructResults(metas, submission.answers);
  return NextResponse.json({ submitted: true, ...resultPayload(submission, results, true) });
}

// 학생 마킹 제출 → 자동 채점 (영어 시험지 / 수학 문제지 공통).
// body: { assignmentId, answers: [{questionId|refId, selected}] }
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const assignment = await loadAssignment(body.assignmentId);
  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  }

  const enrolled = await prisma.enrollment.findFirst({
    where: {
      studentId: student.studentId,
      classId: assignment.classId,
      status: "active",
    },
  });
  if (!enrolled) {
    return NextResponse.json({ error: "이 과제에 접근할 수 없습니다" }, { status: 403 });
  }

  const metas = buildMetas(assignment);

  // #5 재채점 방지: 이미 제출한 과제면 재채점하지 않고 기존 결과를 그대로 반환.
  const existing = await prisma.submission.findFirst({
    where: { studentId: student.studentId, assignmentId: assignment.id },
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
  if (existing) {
    const results = reconstructResults(metas, existing.answers);
    return NextResponse.json(resultPayload(existing, results, true), { status: 200 });
  }

  // 학생 답: refId 또는 questionId 키 모두 허용
  const selectedByRef = new Map<string, string>();
  for (const a of body.answers) {
    const key =
      typeof a?.refId === "string"
        ? a.refId
        : typeof a?.questionId === "string"
        ? a.questionId
        : null;
    if (key && typeof a.selected === "string" && !selectedByRef.has(key)) {
      selectedByRef.set(key, a.selected);
    }
  }

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

    if (meta.writing) {
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
      studentId: student.studentId,
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
      studentId: student.studentId,
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
        studentId: student.studentId,
        answerId: a.id,
      })),
    });
  }

  return NextResponse.json(resultPayload(submission, results, false), { status: 201 });
}
