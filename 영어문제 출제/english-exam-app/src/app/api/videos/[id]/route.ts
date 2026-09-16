import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 영상 상세: 노출 반 + 학생 시청 진도
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      assignments: { include: { class: { select: { id: true, name: true } } } },
      watchProgress: {
        include: {
          student: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!video) {
    return NextResponse.json({ error: "영상을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json({ video });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  await prisma.video.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
