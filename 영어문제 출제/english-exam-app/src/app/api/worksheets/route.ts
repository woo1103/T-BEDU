import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

interface ItemInput {
  number: number;
  answer: string;
  points?: number;
  choicesCount?: number | null;
  tagIds?: string[];
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const worksheets = await prisma.worksheet.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ worksheets });
}

// 문제지 생성: 파일 URL + 문항별 정답키(+태그)
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.title?.trim() || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "제목과 문항(정답키)은 필수입니다" },
      { status: 400 }
    );
  }

  const items: ItemInput[] = body.items;
  for (const it of items) {
    if (typeof it.number !== "number" || !String(it.answer ?? "").trim()) {
      return NextResponse.json(
        { error: "각 문항의 번호와 정답을 입력하세요" },
        { status: 400 }
      );
    }
  }

  const worksheet = await prisma.worksheet.create({
    data: {
      subject: "math",
      title: body.title.trim(),
      source: body.source?.trim() || null,
      grade: body.grade?.trim() || null,
      fileUrl: body.fileUrl?.trim() || null,
      itemCount: items.length,
      items: {
        create: items.map((it) => ({
          number: it.number,
          answer: String(it.answer).trim(),
          points: it.points ?? 1,
          choicesCount: it.choicesCount ?? null,
          itemTags:
            it.tagIds && it.tagIds.length > 0
              ? { create: it.tagIds.map((tagId) => ({ tagId })) }
              : undefined,
        })),
      },
    },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({ worksheet }, { status: 201 });
}
