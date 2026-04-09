import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      items: { include: { question: true }, orderBy: { orderNum: "asc" } },
    },
  });

  if (!exam) {
    return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(exam);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // 기존 items 삭제 후 새로 생성
  await prisma.examItem.deleteMany({ where: { examId: id } });

  const exam = await prisma.exam.update({
    where: { id },
    data: {
      title: body.title,
      examType: body.examType,
      description: body.description || null,
      totalPoints: body.totalPoints || 100,
      timeLimit: body.timeLimit || null,
      headerInfo: body.headerInfo ? JSON.stringify(body.headerInfo) : null,
      instructions: body.instructions || null,
      items: body.items
        ? {
            create: body.items.map(
              (item: { questionId: string; orderNum: number; customPoints?: number }) => ({
                questionId: item.questionId,
                orderNum: item.orderNum,
                customPoints: item.customPoints || null,
              })
            ),
          }
        : undefined,
    },
    include: { items: { include: { question: true } } },
  });

  return NextResponse.json(exam);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
