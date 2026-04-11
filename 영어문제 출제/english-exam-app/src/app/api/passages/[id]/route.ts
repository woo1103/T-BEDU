import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const passage = await prisma.passage.findUnique({ where: { id } });
  if (!passage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(passage);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const content = (body.content || "").trim();
  const wordCount = content ? content.split(/\s+/).length : 0;

  const passage = await prisma.passage.update({
    where: { id },
    data: {
      textbook: body.textbook,
      grade: body.grade,
      lesson: body.lesson,
      title: body.title || null,
      content,
      wordCount,
    },
  });

  return NextResponse.json(passage);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.passage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
