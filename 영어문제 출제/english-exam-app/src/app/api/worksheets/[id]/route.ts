import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const worksheet = await prisma.worksheet.findUnique({
    where: { id },
    include: {
      items: {
        include: { itemTags: { include: { tag: true } } },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!worksheet) {
    return NextResponse.json({ error: "문제지를 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json({ worksheet });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  await prisma.worksheet.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
