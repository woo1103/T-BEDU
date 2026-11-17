import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { decodeMathImage, type MathImageInput } from "@/lib/math-image";

// 업로드로 인식한 문항 중 선생님이 고른 것 하나를 은행에 저장(문제 + 잘라 둔 원본·그림 함께).
// body: { source?, sourceType?, grade?, page?, problem: { number?, problemLatex, solution?, unit?, difficulty? },
//         crop?: Img, figure?: Img }
// 한 번에 한 문항씩 보낸다(요청 크기 제한 4.5MB 안에 그림 두 장이 들어가게).
const DIFFICULTIES = ["하", "중", "상", "킬러"];

export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const p = body?.problem;
  const problemLatex = typeof p?.problemLatex === "string" ? p.problemLatex.trim() : "";
  if (!problemLatex) return NextResponse.json({ error: "문제 본문이 비어 있어요" }, { status: 400 });

  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const images: { kind: "crop" | "figure"; data: Exclude<ReturnType<typeof decodeMathImage>, string> }[] = [];
  for (const kind of ["crop", "figure"] as const) {
    const img = body[kind] as MathImageInput | undefined;
    if (!img) continue;
    const d = decodeMathImage(img);
    if (typeof d === "string") return NextResponse.json({ error: `${kind}: ${d}` }, { status: 400 });
    images.push({ kind, data: d });
  }

  const source = text(body.source);
  const problem = await prisma.$transaction(async (tx) => {
    const ids: { cropImageId?: string; figureImageId?: string } = {};
    for (const img of images) {
      const row = await tx.mathImage.create({ data: img.data, select: { id: true } });
      if (img.kind === "crop") ids.cropImageId = row.id;
      else ids.figureImageId = row.id;
    }
    const difficulty = text(p.difficulty);
    return tx.mathProblem.create({
      data: {
        source,
        sourceType: text(body.sourceType) ?? (source ? "기출" : null),
        grade: text(body.grade),
        unit: text(p.unit),
        difficulty: difficulty && DIFFICULTIES.includes(difficulty) ? difficulty : null,
        number: Number.isInteger(p.number) ? p.number : null,
        problemLatex,
        solution: text(p.solution),
        sourcePage: Number.isInteger(body.page) && body.page > 0 ? body.page : null,
        ...ids,
      },
    });
  });
  return NextResponse.json({ problem }, { status: 201 });
}
