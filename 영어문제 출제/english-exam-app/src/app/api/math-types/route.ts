import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { MATH_TYPES } from "@/lib/math-types";

// 유형코드표 전체 + 유형별 은행 문제 수(화면이 한 번 받아 두고 쓴다)
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const rows = await prisma.mathProblem.groupBy({
    by: ["typeCode"],
    where: { typeCode: { not: null } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((r) => [r.typeCode as string, r._count._all]));
  return NextResponse.json({ ...MATH_TYPES, counts });
}
