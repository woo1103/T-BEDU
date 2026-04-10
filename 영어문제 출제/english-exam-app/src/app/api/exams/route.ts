import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const exams = await prisma.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { question: true }, orderBy: { orderNum: "asc" } } },
  });
  return NextResponse.json(exams);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const exam = await prisma.exam.create({
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

  return NextResponse.json(exam, { status: 201 });
}
