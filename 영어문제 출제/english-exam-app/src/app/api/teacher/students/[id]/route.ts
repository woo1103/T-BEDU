import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, isAdmin } from "@/lib/api-auth";
import { studentAchievement } from "@/lib/achievement";
import { isTarget, parseTargetIds } from "@/lib/assignment-targets";

// 교사: 한 학생의 프로필 + 성취도 + 최근 제출 + 코멘트. [id] = StudentProfile.id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: {
      user: { select: { username: true } },
      center: true,
      enrollments: {
        where: { status: "active" },
        include: { class: { select: { name: true } } },
      },
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다" }, { status: 404 });
  }

  // 담당자는 본인 담당반 소속 학생만 열람
  if (!isAdmin(staff)) {
    const owned = await prisma.enrollment.findFirst({
      where: { studentId: id, class: { teacherId: staff.sub } },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "담당 학생이 아닙니다" }, { status: 403 });
    }
  }

  const achievement = await studentAchievement(id);

  const submissions = await prisma.submission.findMany({
    where: { studentId: id },
    include: { assignment: { select: { title: true } } },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });

  const comments = await prisma.teacherComment.findMany({
    where: { studentId: id },
    orderBy: { updatedAt: "desc" },
  });

  // 이 학생이 받은 과제(반 과제 중 대상인 것) — 학생 상세에서 '이 학생에서 빼기'
  const classAsgs = await prisma.assignment.findMany({
    where: { classId: { in: profile.enrollments.map((e) => e.classId) } },
    include: {
      class: { select: { name: true } },
      submissions: { where: { studentId: id }, orderBy: { submittedAt: "desc" }, take: 1, select: { score: true, totalPoints: true, submittedAt: true } },
    },
    orderBy: { assignedAt: "desc" },
    take: 100,
  });
  const assignments = classAsgs
    .filter((a) => isTarget(a.studentIds, id))
    .map((a) => {
      const ids = parseTargetIds(a.studentIds);
      const sub = a.submissions[0];
      return {
        id: a.id,
        title: a.title,
        className: a.class.name,
        assignedAt: a.assignedAt,
        dueAt: a.dueAt,
        active: a.active,
        // 반 전체 / 지정 학생 몇 명(이 학생뿐이면 빼면 과제가 지워짐)
        targetCount: ids ? ids.length : null,
        submitted: !!sub?.submittedAt,
        score: sub?.submittedAt ? `${sub.score}/${sub.totalPoints}` : null,
      };
    });

  // 영상 시청 진도
  const watch = await prisma.watchProgress.findMany({
    where: { studentId: id },
    include: { video: { select: { title: true, subject: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    student: {
      id: profile.id,
      name: profile.name,
      username: profile.user.username,
      grade: profile.grade,
      status: profile.status,
      center: profile.center?.name ?? null,
      classes: profile.enrollments.map((e) => e.class.name),
    },
    achievement,
    submissions: submissions.map((s) => ({
      id: s.id,
      title: s.assignment.title,
      score: s.score,
      totalPoints: s.totalPoints,
      correctCount: s.correctCount,
      itemCount: s.itemCount,
      rate: s.totalPoints ? Math.round((s.score / s.totalPoints) * 100) : 0,
      submittedAt: s.submittedAt,
    })),
    comments,
    assignments,
    videoProgress: watch.map((w) => ({
      videoId: w.videoId,
      title: w.video.title,
      subject: w.video.subject,
      percent: w.percent,
      completed: w.completed,
      updatedAt: w.updatedAt,
    })),
  });
}
