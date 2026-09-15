import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const links = await prisma.questionTag.findMany({
    where: { questionId: id },
    include: { tag: true },
  });
  return NextResponse.json({
    tags: links.map((l) => l.tag),
    tagIds: links.map((l) => l.tagId),
  });
}

// 문항의 태그를 tagIds 배열로 통째 교체
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const tagIds: string[] = Array.isArray(body.tagIds)
    ? body.tagIds.filter((x: unknown) => typeof x === "string")
    : [];

  await prisma.$transaction([
    prisma.questionTag.deleteMany({ where: { questionId: id } }),
    ...(tagIds.length
      ? [
          prisma.questionTag.createMany({
            data: tagIds.map((tagId) => ({ questionId: id, tagId })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true, tagIds });
}
