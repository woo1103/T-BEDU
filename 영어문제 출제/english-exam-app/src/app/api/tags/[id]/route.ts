import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "태그 이름이 필요합니다" }, { status: 400 });
  }

  try {
    const tag = await prisma.tag.update({
      where: { id },
      data: { name: body.name.trim() },
    });
    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json(
      { error: "이미 있는 이름이거나 태그를 찾을 수 없습니다" },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
