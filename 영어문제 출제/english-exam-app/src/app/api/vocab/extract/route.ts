import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { extractVocab } from "@/lib/claude";

// 단어장 PDF 한 쪽(브라우저가 이미지로 바꿔 보냄) → 단어·뜻 목록. 저장은 하지 않는다(선생님이 확인 후 저장).
// body: { base64, mediaType }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY 미설정" }, { status: 500 });
  const body = await request.json().catch(() => null);
  if (!body?.base64 || !["image/png", "image/jpeg", "image/webp"].includes(body?.mediaType)) {
    return NextResponse.json({ error: "이미지가 필요합니다" }, { status: 400 });
  }
  try {
    return NextResponse.json(await extractVocab({ base64: body.base64, mediaType: body.mediaType }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "단어장 인식 실패" }, { status: 500 });
  }
}
