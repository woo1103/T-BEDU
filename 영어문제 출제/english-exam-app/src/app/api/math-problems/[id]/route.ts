import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { findMathType } from "@/lib/math-types";
import { deleteMathProblems } from "@/lib/math-problem-delete";

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
  for (const f of ["source", "sourceType", "grade", "unit", "difficulty", "problemLatex", "answer", "answerLatex", "solution", "typeCode"] as const) {
    if (typeof body[f] === "string") data[f] = body[f].trim() || null;
  }
  // 유형 코드는 코드표에 있는 것만(오타로 엉뚱한 코드가 저장되지 않게)
  if (data.typeCode && !findMathType(data.typeCode)) {
    return NextResponse.json({ error: `유형코드표에 없는 코드예요: ${data.typeCode}` }, { status: 400 });
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
  // 그림까지 함께 지우고, 학습지에 쓰인 문제는 지우지 않는다
  const { removed, kept } = await deleteMathProblems([id]);
  if (kept.length > 0) {
    return NextResponse.json(
      { error: `이 문제는 학습지에 쓰이고 있어 지울 수 없어요: ${kept[0].worksheets.join(", ")}` },
      { status: 409 }
    );
  }
  if (removed === 0) return NextResponse.json({ error: "이미 지워진 문제예요" }, { status: 404 });
  return NextResponse.json({ success: true });
}
