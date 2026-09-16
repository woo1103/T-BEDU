import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { correctLabel } from "@/lib/grading";
import { areaNamesByQuestion, computeBreakdown } from "@/lib/achievement";

// 학생 마킹 제출 → 자동 채점. body: { assignmentId, answers: [{questionId, selected}] }
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: body.assignmentId },
    include: {
      assessment: {
        include: {
          exam: {
            include: {
              items: { include: { question: true }, orderBy: { orderNum: "asc" } },
            },
          },
        },
      },
    },
  });
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

  const items = assignment.assessment.exam?.items ?? [];

  const selectedByQ = new Map<string, string>();
  for (const a of body.answers) {
    if (a && typeof a.questionId === "string" && typeof a.selected === "string") {
      selectedByQ.set(a.questionId, a.selected);
    }
  }

  let score = 0;
  let totalPoints = 0;
  let correctCount = 0;
  const answerRows: {
    refType: string;
    refId: string;
    selected: string;
    isCorrect: boolean;
    points: number;
  }[] = [];

  for (const item of items) {
    const q = item.question;
    const pts = item.customPoints ?? q.points;
    totalPoints += pts;
    const selected = selectedByQ.get(q.id) ?? "";
    const correct = correctLabel(q);
    const isCorrect = !!correct && selected === correct;
    if (isCorrect) {
      score += pts;
      correctCount++;
    }
    answerRows.push({
      refType: "question",
      refId: q.id,
      selected,
      isCorrect,
      points: isCorrect ? pts : 0,
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
      itemCount: items.length,
      answers: { create: answerRows },
    },
  });

  // 성취도 스냅샷 저장 (영역별 정답률 → 추이/성능)
  const areaMap = await areaNamesByQuestion(answerRows.map((r) => r.refId));
  const breakdown = computeBreakdown(
    answerRows.map((r) => ({ refId: r.refId, isCorrect: r.isCorrect })),
    areaMap
  );
  await prisma.achievementSnapshot.create({
    data: {
      studentId: student.studentId,
      submissionId: submission.id,
      subject: "english",
      overallRate: breakdown.overall.rate,
      byArea: JSON.stringify(breakdown.areas),
    },
  });

  // 오답노트 자동 생성 (틀린 문항)
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

  return NextResponse.json(
    {
      submissionId: submission.id,
      score,
      totalPoints,
      correctCount,
      itemCount: items.length,
      rate: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
    },
    { status: 201 }
  );
}
