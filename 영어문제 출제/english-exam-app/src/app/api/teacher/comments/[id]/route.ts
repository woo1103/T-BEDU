import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 교사 코멘트 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "코멘트 내용이 필요합니다" }, { status: 400 });
  }
  const comment = await prisma.teacherComment.update({
    where: { id },
    data: { body: body.body.trim() },
  });
  return NextResponse.json({ comment });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  await prisma.teacherComment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
