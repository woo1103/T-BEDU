import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const textbooks = await prisma.textbook.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(textbooks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const textbook = await prisma.textbook.create({
    data: {
      title: body.title || "제목 없는 교재",
      description: body.description || null,
      content: body.content || "",
    },
  });
  return NextResponse.json(textbook, { status: 201 });
}
