import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 학생 반 배정(추가). [id] = StudentProfile.id, body: { classId }
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

  // 이미 있으면 active로 되살리고, 없으면 생성. 배정 시 재원생으로.
  await prisma.enrollment.upsert({
    where: { studentId_classId: { studentId: id, classId: body.classId } },
    create: { studentId: id, classId: body.classId, status: "active" },
    update: { status: "active" },
  });
  await prisma.studentProfile.update({
    where: { id },
    data: { status: "enrolled" },
  });

  return NextResponse.json({ success: true });
}

// 학생 반에서 제외. [id]/enroll?classId=
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

  await prisma.enrollment.deleteMany({ where: { studentId: id, classId } });
  return NextResponse.json({ success: true });
}
