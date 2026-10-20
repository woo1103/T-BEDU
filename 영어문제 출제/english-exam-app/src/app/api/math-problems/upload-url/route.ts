import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { isR2Configured, presignPut } from "@/lib/r2";

// 문제 원본 이미지 R2 업로드용 presigned PUT URL. R2 미설정이면 enabled:false 반환(이미지 생략).
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!isR2Configured()) {
    return NextResponse.json({ enabled: false });
  }
  const body = await request.json().catch(() => null);
  if (!body?.filename || !body?.contentType) {
    return NextResponse.json({ error: "filename/contentType 필요" }, { status: 400 });
  }
  const key = `math/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${body.filename}`;
  const uploadUrl = await presignPut(key, body.contentType);
  return NextResponse.json({ enabled: true, uploadUrl, key });
}
