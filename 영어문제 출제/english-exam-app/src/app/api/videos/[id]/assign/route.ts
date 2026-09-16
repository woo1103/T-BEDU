import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 영상을 반에 노출(배정) / 해제. [id] = videoId
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.classId) {
    return NextResponse.json({ error: "반을 선택하세요" }, { status: 400 });
  }

  try {
    const assignment = await prisma.videoAssignment.create({
      data: { videoId: id, classId: body.classId },
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "이미 배정된 반입니다" }, { status: 409 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId가 필요합니다" }, { status: 400 });
  }

  await prisma.videoAssignment.deleteMany({
    where: { videoId: id, classId },
  });
  return NextResponse.json({ success: true });
}
