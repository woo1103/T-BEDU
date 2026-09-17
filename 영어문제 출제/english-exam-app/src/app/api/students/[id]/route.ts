import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 학생 프로필 수정 (이름/학년/재원상태/센터). [id] = StudentProfile.id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: {
    name?: string;
    grade?: string;
    status?: string;
    centerId?: string | null;
  } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.grade === "string" && body.grade.trim()) data.grade = body.grade.trim();
  if (body.status === "enrolled" || body.status === "guest") data.status = body.status;
  if (body.centerId !== undefined) data.centerId = body.centerId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  const student = await prisma.studentProfile.update({ where: { id }, data });
  return NextResponse.json({ student });
}

// 학생 삭제 (로그인 계정까지 완전 삭제 → 프로필·제출·등록 등 cascade)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다" }, { status: 404 });
  }
  // User 삭제 시 StudentProfile(및 하위)까지 cascade
  await prisma.user.delete({ where: { id: profile.userId } });
  return NextResponse.json({ success: true });
}
