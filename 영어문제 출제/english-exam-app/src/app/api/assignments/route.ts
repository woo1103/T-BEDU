import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");

  const assignments = await prisma.assignment.findMany({
    where: classId ? { classId } : {},
    include: {
      assessment: {
        include: { exam: { select: { id: true, title: true } } },
      },
      class: { select: { id: true, name: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
  return NextResponse.json({ assignments });
}

// 반에 시험지(Exam) 배정 → Assessment(type=exam) + Assignment 생성
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.classId || !body?.examId) {
    return NextResponse.json(
      { error: "반과 시험지는 필수입니다" },
      { status: 400 }
    );
  }

  const cls = await prisma.class.findUnique({ where: { id: body.classId } });
  if (!cls) return NextResponse.json({ error: "반을 찾을 수 없습니다" }, { status: 400 });

  const exam = await prisma.exam.findUnique({ where: { id: body.examId } });
  if (!exam) return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 400 });

  const title = body.title?.trim() || exam.title;

  const assessment = await prisma.assessment.create({
    data: { subject: "english", type: "exam", title, examId: exam.id },
  });
  const assignment = await prisma.assignment.create({
    data: {
      classId: body.classId,
      assessmentId: assessment.id,
      title,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    },
    include: { assessment: true, class: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
