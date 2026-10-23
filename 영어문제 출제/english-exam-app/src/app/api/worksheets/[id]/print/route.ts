import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 학습지 인쇄용 데이터: 문항 순서대로 문제은행 원문(LaTeX)·그림 id·정답
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;

  const worksheet = await prisma.worksheet.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      grade: true,
      source: true,
      items: { orderBy: { number: "asc" }, select: { number: true, answer: true, mathProblemId: true } },
    },
  });
  if (!worksheet) return NextResponse.json({ error: "학습지를 찾을 수 없습니다" }, { status: 404 });

  const ids = worksheet.items.map((it) => it.mathProblemId).filter((x): x is string => !!x);
  const problems = await prisma.mathProblem.findMany({
    where: { id: { in: ids } },
    select: { id: true, problemLatex: true, figureImageId: true, solution: true },
  });
  const byId = new Map(problems.map((p) => [p.id, p]));

  return NextResponse.json({
    worksheet: { id: worksheet.id, title: worksheet.title, grade: worksheet.grade, source: worksheet.source },
    // 문제은행에서 만든 학습지가 아니면(PDF 업로드형) 문항 본문이 없다 → 화면에서 안내
    items: worksheet.items.map((it) => {
      const p = it.mathProblemId ? byId.get(it.mathProblemId) : undefined;
      return {
        number: it.number,
        answer: it.answer,
        problemLatex: p?.problemLatex ?? null,
        figureImageId: p?.figureImageId ?? null,
        solution: p?.solution ?? null,
      };
    }),
  });
}
