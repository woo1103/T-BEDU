import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { notifyStudentIds } from "@/lib/notify";

// 독려 알림: 지정 학생들에게 인앱 + 푸시. body: { studentIds, title, body?, linkUrl? }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
  const title = body?.title?.trim();
  if (studentIds.length === 0 || !title) {
    return NextResponse.json({ error: "대상 학생과 제목이 필요합니다" }, { status: 400 });
  }

  const sent = await notifyStudentIds(studentIds, {
    type: "notice",
    title,
    body: body?.body?.trim() || undefined,
    linkUrl: body?.linkUrl || undefined,
  });
  return NextResponse.json({ sent });
}
