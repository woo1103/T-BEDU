import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const textbook = await prisma.textbook.findUnique({
    where: { id },
    include: {
      chapters: {
        orderBy: { orderNum: "asc" },
        include: {
          pages: {
            orderBy: { orderNum: "asc" },
            include: { blocks: { orderBy: { orderNum: "asc" } } },
          },
        },
      },
    },
  });

  if (!textbook) {
    return NextResponse.json({ error: "교재를 찾을 수 없습니다" }, { status: 404 });
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
      subtitle: body.subtitle ?? null,
      description: body.description ?? null,
      coverTemplate: body.coverTemplate,
      pageTemplate: body.pageTemplate,
      themeColor: body.themeColor,
      brandText: body.brandText,
      logoText: body.logoText,
      settings: body.settings ? JSON.stringify(body.settings) : null,
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
