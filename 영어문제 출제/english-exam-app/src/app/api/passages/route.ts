import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const textbook = searchParams.get("textbook");
  const grade = searchParams.get("grade");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (textbook) where.textbook = textbook;
  if (grade) where.grade = grade;
  if (search) {
    where.OR = [
      { content: { contains: search } },
      { title: { contains: search } },
      { lesson: { contains: search } },
    ];
  }

  const passages = await prisma.passage.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(passages);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const content = (body.content || "").trim();
  const wordCount = content ? content.split(/\s+/).length : 0;

  const passage = await prisma.passage.create({
    data: {
      textbook: body.textbook,
      grade: body.grade,
      lesson: body.lesson,
      title: body.title || null,
      content,
      wordCount,
    },
  });

  return NextResponse.json(passage, { status: 201 });
}
