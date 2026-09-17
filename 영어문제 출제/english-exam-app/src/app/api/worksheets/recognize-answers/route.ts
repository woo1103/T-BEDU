import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { recognizeAnswerKey } from "@/lib/claude";

const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

// 정답지 이미지/PDF를 업로드하면 문항별 정답을 자동 인식해 돌려준다.
// body: { base64, mediaType, count? }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.base64 || !body?.mediaType) {
    return NextResponse.json(
      { error: "정답지 파일이 필요합니다." },
      { status: 400 }
    );
  }
  if (!ALLOWED.includes(body.mediaType)) {
    return NextResponse.json(
      { error: "이미지(png/jpg/webp) 또는 PDF만 지원합니다." },
      { status: 400 }
    );
  }

  try {
    const result = await recognizeAnswerKey({
      base64: body.base64,
      mediaType: body.mediaType,
      expectedCount:
        typeof body.count === "number" && body.count > 0 ? body.count : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("정답 인식 오류:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "정답 인식 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
