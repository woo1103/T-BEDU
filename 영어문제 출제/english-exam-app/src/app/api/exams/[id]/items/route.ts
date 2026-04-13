import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 기존 시험지에 문제 append
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const questionIds: string[] = body.questionIds || [];

  if (questionIds.length === 0) {
    return NextResponse.json({ error: "questionIds가 비어있습니다" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { items: { orderBy: { orderNum: "desc" }, take: 1 } },
  });
  if (!exam) {
    return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 404 });
  }

  let nextOrder = (exam.items[0]?.orderNum || 0) + 1;
  const created = [];
  for (const qid of questionIds) {
    const item = await prisma.examItem.create({
      data: { examId: id, questionId: qid, orderNum: nextOrder++ },
    });
    created.push(item);
  }

  return NextResponse.json({ added: created.length }, { status: 201 });
}
