import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { signStudentToken } from "@/lib/student-auth";

// 학생 로그인: 아이디/비밀번호 → 토큰(Bearer) 발급
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력하세요" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { studentProfile: true },
  });
  if (!user || user.role !== "student" || !user.studentProfile) {
    return NextResponse.json(
      { error: "학생 계정을 찾을 수 없습니다" },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다" },
      { status: 401 }
    );
  }

  const token = await signStudentToken({
    sub: user.id,
    studentId: user.studentProfile.id,
    username: user.username,
    role: "student",
  });

  return NextResponse.json({
    token,
    student: {
      id: user.studentProfile.id,
      username: user.username,
      name: user.studentProfile.name,
      grade: user.studentProfile.grade,
      status: user.studentProfile.status,
    },
  });
}
