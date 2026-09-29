import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 학년도 목록 (반 개수 포함)
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const terms = await prisma.academicTerm.findMany({
    include: { _count: { select: { classes: true } } },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ terms });
}

// 학년도 생성. body: { name, year, isCurrent? }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const year = Number(body?.year);
  if (!name || !Number.isFinite(year)) {
    return NextResponse.json({ error: "이름과 연도를 입력하세요" }, { status: 400 });
  }

  const makeCurrent = body?.isCurrent === true;
  const term = await prisma.$transaction(async (tx) => {
    if (makeCurrent) {
      await tx.academicTerm.updateMany({ data: { isCurrent: false } });
    }
    return tx.academicTerm.create({
      data: { name, year, isCurrent: makeCurrent },
    });
  });
  return NextResponse.json({ term }, { status: 201 });
}
