import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { extractMathProblems } from "@/lib/claude";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

// 수학 문제 이미지/PDF 업로드 → 비전으로 문항 분리·LaTeX 추출 → MathProblem DB 저장.
// body: { base64, mediaType, source?, sourceType?, grade?, imageKey? }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 미설정" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.base64 || !body?.mediaType) {
    return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });
  }
  if (!ALLOWED.includes(body.mediaType)) {
    return NextResponse.json({ error: "이미지(png/jpg/webp) 또는 PDF만 지원" }, { status: 400 });
  }

  let extracted;
  try {
    extracted = await extractMathProblems({
      base64: body.base64,
      mediaType: body.mediaType,
      hint: { source: body.source, grade: body.grade },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "문제 인식 실패" },
      { status: 500 }
    );
  }
  if (extracted.problems.length === 0) {
    return NextResponse.json({ error: "문제를 인식하지 못했습니다. 더 선명한 이미지로 시도하세요." }, { status: 422 });
  }

  const source = body.source?.trim() || null;
  const sourceType = body.sourceType?.trim() || (source ? "기출" : null);
  const grade = body.grade?.trim() || null;
  const imageUrl = body.imageKey?.trim() || null;

  const created = await prisma.$transaction(
    extracted.problems.map((p) =>
      prisma.mathProblem.create({
        data: {
          source,
          sourceType,
          grade,
          unit: p.unit || null,
          difficulty: p.difficulty || null,
          number: p.number ?? null,
          problemLatex: p.problemLatex,
          answer: p.answer || null,
          answerLatex: p.answerLatex || null,
          solution: p.solution || null,
          imageUrl,
        },
      })
    )
  );

  return NextResponse.json({ count: created.length, problems: created }, { status: 201 });
}
