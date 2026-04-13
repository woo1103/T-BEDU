import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { username, password, role } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요" }, { status: 400 });
  }

  const validRole = role === "admin" ? "admin" : "teacher";

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ error: "이미 존재하는 아이디입니다" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: validRole,
    },
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
