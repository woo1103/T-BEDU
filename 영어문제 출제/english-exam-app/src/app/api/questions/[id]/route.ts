import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { questionUsage } from "@/lib/usage-check";

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

  // 지문·발문·선지·정답이 바뀌면 이전 검수 결과는 무효 → 미검수로
  const before = await prisma.question.findUnique({
    where: { id },
    select: { passage: true, question: true, choices: true, answer: true },
  });
  const contentChanged =
    !before ||
    before.passage !== body.passage ||
    before.question !== body.question ||
    before.choices !== JSON.stringify(body.choices) ||
    before.answer !== body.answer;

  const question = await prisma.question.update({
    where: { id },
    data: {
      ...(contentChanged ? { verifyStatus: null, verifyNote: null, verifiedAt: null } : {}),
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
  // 시험지에 들어간 문항은 지울 수 없다(DB 제약) — 이유를 알려 준다
  const usage = await questionUsage(id);
  if (usage.exams.length > 0) {
    const names = usage.exams.slice(0, 3).map((e) => `'${e.title}'`).join(", ");
    const more = usage.exams.length > 3 ? ` 외 ${usage.exams.length - 3}개` : "";
    return NextResponse.json(
      { error: `시험지 ${names}${more}에 들어 있어 지울 수 없어요. 시험지에서 먼저 빼 주세요.`, usage },
      { status: 409 }
    );
  }
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
