import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, string> = {};

  if (body.username) data.username = body.username;
  if (body.password) data.passwordHash = await hashPassword(body.password);
  if (body.role === "admin" || body.role === "teacher") data.role = body.role;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경 사항 없음" }, { status: 400 });
  }

  if (data.username) {
    const exists = await prisma.user.findFirst({
      where: { username: data.username, NOT: { id } },
    });
    if (exists) {
      return NextResponse.json({ error: "이미 존재하는 아이디입니다" }, { status: 409 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;

  if (id === admin.sub) {
    return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
