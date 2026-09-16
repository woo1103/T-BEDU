import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 내 알림 목록 + 안 읽음 수
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: student.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: student.sub, read: false } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

// 읽음 처리: { id } 있으면 해당 1개, 없으면 전체
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: student.sub },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: student.sub, read: false },
      data: { read: true },
    });
  }
  return NextResponse.json({ success: true });
}
