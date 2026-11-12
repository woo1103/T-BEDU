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

  // 같은 교과서에 같은 본문이 이미 있으면 알려 준다(PDF 가져오기를 두 번 돌렸을 때 등). ?force=1 이면 그냥 저장
  if (content && request.nextUrl.searchParams.get("force") !== "1") {
    const dup = await prisma.passage.findFirst({
      where: { textbook: body.textbook, content },
      select: { id: true, lesson: true, title: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: `같은 지문이 이미 있어요: ${dup.lesson}${dup.title ? ` · ${dup.title}` : ""}`, duplicateOf: dup.id },
        { status: 409 }
      );
    }
  }

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
