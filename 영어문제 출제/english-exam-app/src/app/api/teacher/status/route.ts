import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, canAccessClass } from "@/lib/api-auth";

// 반별 현황판: 과제 미제출자 + 영상 미시청자. GET ?classId=
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId가 필요합니다" }, { status: 400 });
  }
  if (!(await canAccessClass(staff, classId))) {
    return NextResponse.json({ error: "담당 반이 아닙니다" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true },
  });
  if (!cls) return NextResponse.json({ error: "반을 찾을 수 없습니다" }, { status: 404 });

  // 활성 재원생
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "active" },
    include: { student: { select: { id: true, name: true, user: { select: { username: true } } } } },
  });
  const students = enrollments.map((e) => ({
    id: e.student.id,
    name: e.student.name,
    username: e.student.user.username,
  }));
  const studentIds = students.map((s) => s.id);

  // 과제 + 제출자
  const assignments = await prisma.assignment.findMany({
    where: { classId, active: true },
    include: {
      submissions: {
        where: { studentId: { in: studentIds } },
        select: { studentId: true },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
  const assignmentRows = assignments.map((a) => {
    const submitted = new Set(a.submissions.map((s) => s.studentId));
    const missing = students.filter((s) => !submitted.has(s.id));
    return {
      id: a.id,
      title: a.title,
      dueAt: a.dueAt,
      submittedCount: submitted.size,
      total: students.length,
      missing,
    };
  });

  // 영상 + 시청자
  const vAssigns = await prisma.videoAssignment.findMany({
    where: { classId },
    include: { video: { select: { id: true, title: true } } },
  });
  const videoIds = vAssigns.map((v) => v.videoId);
  const progress = await prisma.watchProgress.findMany({
    where: { videoId: { in: videoIds }, studentId: { in: studentIds } },
    select: { videoId: true, studentId: true, percent: true },
  });
  const videoRows = vAssigns.map((va) => {
    // 시청 = 진도 1% 이상 기록
    const watched = new Set(
      progress.filter((p) => p.videoId === va.videoId && p.percent > 0).map((p) => p.studentId)
    );
    const notWatched = students.filter((s) => !watched.has(s.id));
    return {
      videoId: va.videoId,
      title: va.video.title,
      watchedCount: watched.size,
      total: students.length,
      notWatched,
    };
  });

  return NextResponse.json({
    className: cls.name,
    studentCount: students.length,
    assignments: assignmentRows,
    videos: videoRows,
  });
}
