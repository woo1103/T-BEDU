import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { isR2Configured, presignPut } from "@/lib/r2";

// 교사: R2 직접 업로드용 presigned PUT URL 발급. 반환한 key를 영상 등록 시 url로 저장.
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 스토리지가 설정되지 않았습니다 (env: R2_ACCOUNT_ID 등)" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.filename || !body?.contentType) {
    return NextResponse.json(
      { error: "filename과 contentType이 필요합니다" },
      { status: 400 }
    );
  }

  const safe = String(body.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const uploadUrl = await presignPut(key, body.contentType);

  return NextResponse.json({ uploadUrl, key });
}
