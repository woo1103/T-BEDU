import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const chapter = await prisma.chapter.update({
    where: { id },
    data: {
      title: body.title,
    },
  });
  return NextResponse.json(chapter);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.chapter.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
