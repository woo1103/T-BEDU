import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { notifyClassStudents } from "@/lib/notify";

// 교사가 반 학생들에게 알림 발송
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.classId || !body?.title?.trim()) {
    return NextResponse.json({ error: "반과 제목은 필수입니다" }, { status: 400 });
  }

  const sent = await notifyClassStudents(body.classId, {
    type: body.type || "notice",
    title: body.title.trim(),
    body: body.body?.trim() || undefined,
    linkUrl: body.linkUrl?.trim() || undefined,
  });
  return NextResponse.json({ sent });
}
