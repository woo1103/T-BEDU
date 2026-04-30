import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractQuestionIds } from "@/lib/textbook-parser";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const textbook = await prisma.textbook.findUnique({ where: { id } });
  if (!textbook) {
    return NextResponse.json({ error: "교재를 찾을 수 없습니다" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("withQuestions") === "1") {
    const ids = extractQuestionIds(textbook.content);
    const questions = ids.length
      ? await prisma.question.findMany({ where: { id: { in: ids } } })
      : [];
    const map: Record<string, (typeof questions)[number]> = {};
    for (const q of questions) map[q.id] = q;
    return NextResponse.json({ textbook, questions: map });
  }

  return NextResponse.json(textbook);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const textbook = await prisma.textbook.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description ?? null,
      content: body.content ?? "",
    },
  });
  return NextResponse.json(textbook);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.textbook.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
