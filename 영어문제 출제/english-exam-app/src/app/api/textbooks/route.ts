import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const textbooks = await prisma.textbook.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      chapters: {
        orderBy: { orderNum: "asc" },
        include: { pages: { orderBy: { orderNum: "asc" } } },
      },
    },
  });
  return NextResponse.json(textbooks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const textbook = await prisma.textbook.create({
    data: {
      title: body.title,
      subtitle: body.subtitle || null,
      description: body.description || null,
      coverTemplate: body.coverTemplate || "classic",
      pageTemplate: body.pageTemplate || "default",
      themeColor: body.themeColor || "#4FC3F7",
      brandText: body.brandText || "T&BEDU",
      logoText: body.logoText || "T",
      settings: body.settings ? JSON.stringify(body.settings) : null,
    },
  });

  return NextResponse.json(textbook, { status: 201 });
}
