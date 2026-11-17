import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { extractMathProblems } from "@/lib/claude";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

// 수학 문제지 한 쪽(이미지) 또는 PDF → 비전으로 문항 분리·LaTeX·위치 추출. DB에는 저장하지 않는다:
// 브라우저가 결과를 보여 주고, 선생님이 고른 문항만 /api/math-problems/save 로 저장한다.
// body: { base64, mediaType, source?, grade?, page? }
// 응답의 각 문항 box/figureBox(쪽 안 위치 0~1)로 브라우저가 문제 영역·그림을 잘라 둔다.
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
    // 쪽 단위 업로드에선 정답표·빈 쪽 등 문항 없는 쪽이 정상적으로 나온다
    if (Number.isInteger(body.page)) return NextResponse.json({ count: 0, problems: [] });
    return NextResponse.json({ error: "문제를 인식하지 못했습니다. 더 선명한 이미지로 시도하세요." }, { status: 422 });
  }

  return NextResponse.json({ count: extracted.problems.length, problems: extracted.problems });
}
