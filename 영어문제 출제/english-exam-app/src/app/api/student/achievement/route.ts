import { NextRequest, NextResponse } from "next/server";
import { getStudentFromRequest } from "@/lib/student-auth";
import { studentAchievement } from "@/lib/achievement";

// 학생 본인의 전체 성취도: 전체+영역별 정답률 + 취약/강점
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const data = await studentAchievement(student.studentId);
  return NextResponse.json(data);
}
