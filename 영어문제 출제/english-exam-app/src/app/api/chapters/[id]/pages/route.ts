import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 페이지 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const last = await prisma.textbookPage.findFirst({
    where: { chapterId: id },
    orderBy: { orderNum: "desc" },
  });
  const page = await prisma.textbookPage.create({
    data: {
      chapterId: id,
      title: body.title || null,
      orderNum: (last?.orderNum || 0) + 1,
    },
  });
  return NextResponse.json(page, { status: 201 });
}

// 페이지 순서 재정렬
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const order: string[] = body.order || [];
  await prisma.$transaction(
    order.map((pid, idx) =>
      prisma.textbookPage.update({
        where: { id: pid },
        data: { orderNum: idx + 1 },
      })
    )
  );
  const pages = await prisma.textbookPage.findMany({
    where: { chapterId: id },
    orderBy: { orderNum: "asc" },
  });
  return NextResponse.json(pages);
}
