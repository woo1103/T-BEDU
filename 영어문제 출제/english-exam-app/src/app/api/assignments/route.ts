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
  if (!body?.classId || (!body?.examId && !body?.worksheetId)) {
    return NextResponse.json(
      { error: "반과 시험지(또는 문제지)는 필수입니다" },
      { status: 400 }
    );
  }

  const cls = await prisma.class.findUnique({ where: { id: body.classId } });
  if (!cls) return NextResponse.json({ error: "반을 찾을 수 없습니다" }, { status: 400 });

  let assessmentData: {
    subject: string;
    type: string;
    examId?: string;
    worksheetId?: string;
  };
  let defaultTitle: string;

  if (body.examId) {
    const exam = await prisma.exam.findUnique({ where: { id: body.examId } });
    if (!exam)
      return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 400 });
    defaultTitle = exam.title;
    assessmentData = { subject: "english", type: "exam", examId: exam.id };
  } else {
    const ws = await prisma.worksheet.findUnique({ where: { id: body.worksheetId } });
    if (!ws)
      return NextResponse.json({ error: "문제지를 찾을 수 없습니다" }, { status: 400 });
    defaultTitle = ws.title;
    assessmentData = { subject: "math", type: "worksheet", worksheetId: ws.id };
  }

  const title = body.title?.trim() || defaultTitle;

  const assessment = await prisma.assessment.create({
    data: { ...assessmentData, title },
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
