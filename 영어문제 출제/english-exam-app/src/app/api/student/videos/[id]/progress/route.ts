import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 시청 진도 저장. [id] = videoId. body: { positionSec, percent, completed? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;

  // 본인 반에 노출된 영상인지 확인
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.studentId, status: "active" },
    select: { classId: true },
  });
  const classIds = enrollments.map((e) => e.classId);
  const assigned = await prisma.videoAssignment.findFirst({
    where: { videoId: id, classId: { in: classIds } },
  });
  if (!assigned) {
    return NextResponse.json({ error: "접근할 수 없는 영상입니다" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const positionSec = Math.max(0, Math.floor(Number(body.positionSec) || 0));
  const percent = Math.min(100, Math.max(0, Math.floor(Number(body.percent) || 0)));

  const existing = await prisma.watchProgress.findUnique({
    where: { studentId_videoId: { studentId: student.studentId, videoId: id } },
  });
  const completed = existing?.completed || percent >= 90 || body.completed === true;

  const saved = await prisma.watchProgress.upsert({
    where: { studentId_videoId: { studentId: student.studentId, videoId: id } },
    create: { studentId: student.studentId, videoId: id, positionSec, percent, completed },
    update: { positionSec, percent, completed },
  });

  return NextResponse.json({
    progress: {
      positionSec: saved.positionSec,
      percent: saved.percent,
      completed: saved.completed,
    },
  });
}
