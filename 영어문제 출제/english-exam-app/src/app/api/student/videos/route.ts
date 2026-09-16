import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 학생의 활성 반에 노출된 영상 + 내 시청 진도
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.studentId, status: "active" },
    select: { classId: true },
  });
  const classIds = enrollments.map((e) => e.classId);
  if (classIds.length === 0) return NextResponse.json({ videos: [] });

  const assigns = await prisma.videoAssignment.findMany({
    where: { classId: { in: classIds } },
    include: { video: true },
    orderBy: { createdAt: "desc" },
  });
  const videoMap = new Map<string, (typeof assigns)[number]["video"]>();
  for (const a of assigns) videoMap.set(a.video.id, a.video);
  const videos = [...videoMap.values()];

  const progress = await prisma.watchProgress.findMany({
    where: { studentId: student.studentId, videoId: { in: videos.map((v) => v.id) } },
  });
  const progMap = new Map(progress.map((p) => [p.videoId, p]));

  return NextResponse.json({
    videos: videos.map((v) => {
      const p = progMap.get(v.id);
      return {
        id: v.id,
        title: v.title,
        subject: v.subject,
        description: v.description,
        url: v.url,
        provider: v.provider,
        progress: p
          ? { positionSec: p.positionSec, percent: p.percent, completed: p.completed }
          : null,
      };
    }),
  });
}
