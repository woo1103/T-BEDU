import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 수학 문제 수정 (LaTeX·정답·출처·메타)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: Record<string, string | null> = {};
  for (const f of ["source", "sourceType", "grade", "unit", "difficulty", "problemLatex", "answer", "answerLatex", "solution"] as const) {
    if (typeof body[f] === "string") data[f] = body[f].trim() || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }
  const problem = await prisma.mathProblem.update({ where: { id }, data });
  return NextResponse.json({ problem });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  await prisma.mathProblem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
