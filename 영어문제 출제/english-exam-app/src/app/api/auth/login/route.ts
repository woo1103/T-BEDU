import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  signSession,
  setSessionCookie,
  ensureSeedAdmin,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  await ensureSeedAdmin();

  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const token = await signSession({
    sub: user.id,
    username: user.username,
    role: user.role as "admin" | "teacher",
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role },
  });
}
