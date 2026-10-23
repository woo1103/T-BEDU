import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isVerifiedSignature } from "@/lib/verify";

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
    include: {
      passageRef: true,
      examItems: {
        include: {
          exam: {
            select: {
              id: true,
              title: true,
              headerInfo: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(questions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // 생성 API에서 검수를 통과한 내용이 그대로 저장될 때만 '검수 통과'로 기록
  const verified =
    Array.isArray(body.choices) &&
    isVerifiedSignature({ passage: body.passage, question: body.question, choices: body.choices }, body.verifySig);

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
      passageId: body.passageId || null,
      ...(verified ? { verifyStatus: "ok", verifiedAt: new Date() } : {}),
    },
  });

  return NextResponse.json(question, { status: 201 });
}
