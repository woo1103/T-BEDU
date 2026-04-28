import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 단원 추가 (해당 교재에 append)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title은 필수입니다" }, { status: 400 });
  }
  const last = await prisma.chapter.findFirst({
    where: { textbookId: id },
    orderBy: { orderNum: "desc" },
  });
  const chapter = await prisma.chapter.create({
    data: {
      textbookId: id,
      title: body.title,
      orderNum: (last?.orderNum || 0) + 1,
    },
  });
  return NextResponse.json(chapter, { status: 201 });
}

// 단원 순서 일괄 재정렬: { order: [chapterId1, chapterId2, ...] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const order: string[] = body.order || [];
  await prisma.$transaction(
    order.map((cid, idx) =>
      prisma.chapter.update({
        where: { id: cid },
        data: { orderNum: idx + 1 },
      })
    )
  );
  const chapters = await prisma.chapter.findMany({
    where: { textbookId: id },
    orderBy: { orderNum: "asc" },
  });
  return NextResponse.json(chapters);
}
