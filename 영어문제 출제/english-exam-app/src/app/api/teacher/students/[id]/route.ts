import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { studentAchievement } from "@/lib/achievement";

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
