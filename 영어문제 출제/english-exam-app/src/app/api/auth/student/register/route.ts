import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { signStudentToken } from "@/lib/student-auth";

// 학생 회원가입: 반 코드가 있으면 재원생(enrolled)+반 등록, 없으면 비재원생(guest)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  const { username, password, name, grade, classCode, centerId } = body;

  if (!username || !password || !name || !grade) {
    return NextResponse.json(
      { error: "필수 항목(아이디·비밀번호·이름·학년)을 입력하세요" },
      { status: 400 }
    );
  }
  if (String(password).length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 6자 이상이어야 합니다" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다" },
      { status: 409 }
    );
  }

  // 반 코드 확인 → 있으면 재원생
  let matchedClass = null;
  if (classCode) {
    matchedClass = await prisma.class.findUnique({
      where: { code: String(classCode).trim() },
    });
    if (!matchedClass || !matchedClass.active) {
      return NextResponse.json(
        { error: "유효하지 않은 반 코드입니다" },
        { status: 400 }
      );
    }
  }

  const status = matchedClass ? "enrolled" : "guest";
  const resolvedCenterId = matchedClass ? matchedClass.centerId : centerId || null;
  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, passwordHash, role: "student" },
    });
    const profile = await tx.studentProfile.create({
      data: {
        userId: user.id,
        name,
        grade,
        status,
        centerId: resolvedCenterId,
      },
    });
    if (matchedClass) {
      await tx.enrollment.create({
        data: { studentId: profile.id, classId: matchedClass.id, status: "active" },
      });
    }
    return { user, profile };
  });

  const token = await signStudentToken({
    sub: result.user.id,
    studentId: result.profile.id,
    username: result.user.username,
    role: "student",
  });

  return NextResponse.json(
    {
      token,
      student: {
        id: result.profile.id,
        username: result.user.username,
        name: result.profile.name,
        grade: result.profile.grade,
        status: result.profile.status,
        enrolledClassId: matchedClass?.id ?? null,
      },
    },
    { status: 201 }
  );
}
