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
    // 응답을 가볍게: 지문 본문은 문항의 passage에 이미 있으므로 지문 정보는 분류용 칸만,
    // 출제 이력은 시험지 제목·날짜만 싣는다(문항이 많아지면 응답 크기 제한 4.5MB에 걸려 목록이 안 뜸)
    include: {
      passageRef: { select: { id: true, textbook: true, grade: true, lesson: true, title: true } },
      examItems: {
        select: {
          id: true,
          examId: true,
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

  // 문항별 누적 정답률(학생 답 기준). 답이 없는 문항은 stats 없음.
  // 운영 DB(Turso)는 한 쿼리에 넣을 수 있는 값 개수에 한도가 있다 → 문항 id를 500개씩 나눠 묻는다
  // (문항이 늘어 한도를 넘자 목록 전체가 500 오류로 안 뜨던 문제, 2026-11)
  const ids = questions.map((q) => q.id);
  const grouped = [];
  for (let i = 0; i < ids.length; i += 500) {
    grouped.push(
      ...(await prisma.answer.groupBy({
        by: ["refId", "isCorrect"],
        where: { refType: "question", refId: { in: ids.slice(i, i + 500) } },
        _count: { _all: true },
      }))
    );
  }
  const stats = new Map<string, { answered: number; correct: number }>();
  for (const g of grouped) {
    const cur = stats.get(g.refId) ?? { answered: 0, correct: 0 };
    cur.answered += g._count._all;
    if (g.isCorrect) cur.correct += g._count._all;
    stats.set(g.refId, cur);
  }
  return NextResponse.json(questions.map((q) => ({ ...q, stats: stats.get(q.id) ?? null })));
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
