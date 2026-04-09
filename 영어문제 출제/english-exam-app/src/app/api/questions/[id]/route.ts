import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id } });

  if (!question) {
    return NextResponse.json({ error: "문제를 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(question);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const question = await prisma.question.update({
    where: { id },
    data: {
      examType: body.examType,
      questionType: body.questionType,
      number: body.number || null,
      points: body.points,
      passage: body.passage,
      question: body.question,
      choices: JSON.stringify(body.choices),
      answer: body.answer,
      explanation: body.explanation || null,
      difficulty: body.difficulty,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      source: body.source || null,
    },
  });

  return NextResponse.json(question);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
