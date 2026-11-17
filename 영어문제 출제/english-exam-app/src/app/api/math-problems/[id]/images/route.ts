import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { decodeMathImage as decode, type MathImageInput as Img } from "@/lib/math-image";

// 문항별 잘라낸 이미지 저장(DB). body: { crop?: Img, figure?: Img | null }
//   crop   = 문제 영역(인식 확인용), figure = 그림·그래프·표(학습지 인쇄용). figure: null 이면 그림 삭제.
// Img = { base64: string(JPEG/PNG, data: 접두어 없이), mime: "image/jpeg" | "image/png", width, height }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { crop?: Img; figure?: Img | null };

  const problem = await prisma.mathProblem.findUnique({
    where: { id },
    select: { cropImageId: true, figureImageId: true },
  });
  if (!problem) return NextResponse.json({ error: "문제를 찾을 수 없습니다" }, { status: 404 });

  const update: { cropImageId?: string; figureImageId?: string | null } = {};
  const stale: string[] = [];

  for (const kind of ["crop", "figure"] as const) {
    const img = body[kind];
    if (img === undefined) continue;
    const prev = kind === "crop" ? problem.cropImageId : problem.figureImageId;
    if (img === null) {
      if (kind === "figure") {
        update.figureImageId = null;
        if (prev) stale.push(prev);
      }
      continue;
    }
    const d = decode(img);
    if (typeof d === "string") return NextResponse.json({ error: `${kind}: ${d}` }, { status: 400 });
    const row = await prisma.mathImage.create({ data: d, select: { id: true } });
    if (kind === "crop") update.cropImageId = row.id;
    else update.figureImageId = row.id;
    if (prev) stale.push(prev);
  }

  const updated = await prisma.mathProblem.update({ where: { id }, data: update });
  if (stale.length > 0) await prisma.mathImage.deleteMany({ where: { id: { in: stale } } });
  return NextResponse.json({ problem: updated });
}
