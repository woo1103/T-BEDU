import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { extractPassages } from "@/lib/claude";

export const maxDuration = 120;

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// 교재 한 쪽 이미지 → 영어 지문 목록(저장하지 않음 — 화면에서 확인·수정 후 저장)
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 미설정" }, { status: 500 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.base64 || !ALLOWED.includes(body?.mediaType)) {
    return NextResponse.json({ error: "쪽 이미지가 필요합니다" }, { status: 400 });
  }
  try {
    return NextResponse.json(await extractPassages({ base64: body.base64, mediaType: body.mediaType }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "지문 인식 실패" }, { status: 500 });
  }
}
