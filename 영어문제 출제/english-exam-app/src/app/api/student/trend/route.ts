import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 성적 추이: 제출별 전체 정답률(시간순)
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const snaps = await prisma.achievementSnapshot.findMany({
    where: { studentId: student.studentId },
    orderBy: { createdAt: "asc" },
    select: { overallRate: true, createdAt: true },
  });

  return NextResponse.json({
    points: snaps.map((s) => ({ rate: s.overallRate, at: s.createdAt })),
  });
}
