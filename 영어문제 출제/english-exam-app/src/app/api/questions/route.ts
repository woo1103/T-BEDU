import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examType = searchParams.get("examType");
  const questionType = searchParams.get("questionType");
  const difficulty = searchParams.get("difficulty");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (examType) where.examType = examType;
  if (questionType) where.questionType = questionType;
  if (difficulty) where.difficulty = difficulty;
  if (search) {
    where.OR = [
      { question: { contains: search } },
      { passage: { contains: search } },
    ];
  }

  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(questions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const question = await prisma.question.create({
    data: {
      examType: body.examType,
      questionType: body.questionType,
      number: body.number || null,
      points: body.points || 2,
      passage: body.passage,
      question: body.question,
      choices: JSON.stringify(body.choices),
      answer: body.answer,
      explanation: body.explanation || null,
      difficulty: body.difficulty || "medium",
      tags: body.tags ? JSON.stringify(body.tags) : null,
      source: body.source || null,
      aiGenerated: body.aiGenerated || false,
    },
  });

  return NextResponse.json(question, { status: 201 });
}
