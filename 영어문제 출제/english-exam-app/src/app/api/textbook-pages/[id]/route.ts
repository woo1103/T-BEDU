import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const page = await prisma.textbookPage.update({
    where: { id },
    data: {
      title: body.title ?? null,
    },
  });
  return NextResponse.json(page);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.textbookPage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
