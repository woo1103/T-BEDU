import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 학년도 수정: 현재 학년도로 설정 / 이름 변경. body: { setCurrent?, name? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  await prisma.$transaction(async (tx) => {
    if (body.setCurrent === true) {
      await tx.academicTerm.updateMany({ data: { isCurrent: false } });
      await tx.academicTerm.update({ where: { id }, data: { isCurrent: true } });
    }
    if (typeof body.name === "string" && body.name.trim()) {
      await tx.academicTerm.update({ where: { id }, data: { name: body.name.trim() } });
    }
  });

  const term = await prisma.academicTerm.findUnique({ where: { id } });
  return NextResponse.json({ term });
}

// 학년도 삭제 (반이 없을 때만)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const count = await prisma.class.count({ where: { termId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `이 학년도에 반이 ${count}개 있어 삭제할 수 없습니다` },
      { status: 400 }
    );
  }
  await prisma.academicTerm.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
