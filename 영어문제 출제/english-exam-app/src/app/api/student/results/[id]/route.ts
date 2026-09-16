import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { areaNamesByQuestion, computeBreakdown } from "@/lib/achievement";

// 단일 제출 결과: 점수·영역별·문항별 정오. [id] = submissionId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      answers: true,
      assignment: { select: { title: true } },
    },
  });
  if (!submission || submission.studentId !== student.studentId) {
    return NextResponse.json({ error: "결과를 찾을 수 없습니다" }, { status: 404 });
  }

  const qIds = submission.answers.map((a) => a.refId);
  const areaMap = await areaNamesByQuestion(qIds);
  const breakdown = computeBreakdown(
    submission.answers.map((a) => ({ refId: a.refId, isCorrect: a.isCorrect })),
    areaMap
  );

  return NextResponse.json({
    submission: {
      id: submission.id,
      title: submission.assignment.title,
      score: submission.score,
      totalPoints: submission.totalPoints,
      correctCount: submission.correctCount,
      itemCount: submission.itemCount,
      rate: submission.totalPoints
        ? Math.round((submission.score / submission.totalPoints) * 100)
        : 0,
    },
    overall: breakdown.overall,
    areas: breakdown.areas,
    answers: submission.answers.map((a) => ({
      questionId: a.refId,
      selected: a.selected,
      isCorrect: a.isCorrect,
      points: a.points,
      areas: areaMap.get(a.refId) ?? [],
    })),
  });
}
