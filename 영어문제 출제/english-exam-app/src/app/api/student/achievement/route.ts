import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { areaNamesByQuestion, computeBreakdown } from "@/lib/achievement";

// 학생의 전체 성취도: 전체 정답률 + 영역별 정답률 + 취약/강점
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const answers = await prisma.answer.findMany({
    where: {
      refType: "question",
      submission: { studentId: student.studentId },
    },
    select: { refId: true, isCorrect: true },
  });

  const areaMap = await areaNamesByQuestion([
    ...new Set(answers.map((a) => a.refId)),
  ]);
  const breakdown = computeBreakdown(answers, areaMap);

  const weak = breakdown.areas.filter((a) => a.total >= 1 && a.rate < 60);
  const strong = breakdown.areas.filter((a) => a.total >= 1 && a.rate >= 80);

  const submissionCount = await prisma.submission.count({
    where: { studentId: student.studentId, status: "graded" },
  });

  return NextResponse.json({
    overall: breakdown.overall,
    areas: breakdown.areas,
    weak,
    strong,
    submissionCount,
  });
}
