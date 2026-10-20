import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 수학 문제 은행 목록 (필터: grade, unit, source, difficulty, q=검색)
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const where: {
    grade?: string;
    unit?: string;
    difficulty?: string;
    source?: { contains: string };
    problemLatex?: { contains: string };
  } = {};
  if (sp.get("grade")) where.grade = sp.get("grade")!;
  if (sp.get("unit")) where.unit = sp.get("unit")!;
  if (sp.get("difficulty")) where.difficulty = sp.get("difficulty")!;
  if (sp.get("source")) where.source = { contains: sp.get("source")! };
  const q = sp.get("q");
  if (q) where.problemLatex = { contains: q };

  const problems = await prisma.mathProblem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  // 필터용 distinct 값
  const all = await prisma.mathProblem.findMany({
    select: { grade: true, unit: true, source: true },
    take: 2000,
  });
  const grades = [...new Set(all.map((x) => x.grade).filter(Boolean))] as string[];
  const units = [...new Set(all.map((x) => x.unit).filter(Boolean))] as string[];
  const sources = [...new Set(all.map((x) => x.source).filter(Boolean))] as string[];

  return NextResponse.json({ problems, facets: { grades, units, sources } });
}
