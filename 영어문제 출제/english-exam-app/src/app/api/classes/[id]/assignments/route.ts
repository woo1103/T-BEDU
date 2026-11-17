import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, canAccessClass } from "@/lib/api-auth";

// 반에 낸 과제 전체 삭제(현황판). 기본은 제출이 없는 과제만 지우고,
// ?withSubmissions=1 이면 제출이 있는 과제도 제출·오답노트·성취도 기록과 함께 지운다.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id: classId } = await params;
  if (!(await canAccessClass(staff, classId))) {
    return NextResponse.json({ error: "담당 반이 아닙니다" }, { status: 403 });
  }

  const withSubmissions = request.nextUrl.searchParams.get("withSubmissions") === "1";
  const all = await prisma.assignment.findMany({
    where: { classId },
    select: { id: true, _count: { select: { submissions: true } } },
  });
  const targets = withSubmissions ? all : all.filter((a) => a._count.submissions === 0);
  const kept = all.length - targets.length;
  if (targets.length === 0) {
    return NextResponse.json({ removed: 0, kept, submissionsRemoved: 0 });
  }

  const ids = targets.map((a) => a.id);
  const subs = await prisma.submission.findMany({ where: { assignmentId: { in: ids } }, select: { id: true } });
  // 과제를 지우면 제출·답·오답노트는 함께 지워지고, 성취도 스냅샷은 연결이 없어 따로 지운다
  await prisma.$transaction([
    prisma.achievementSnapshot.deleteMany({ where: { submissionId: { in: subs.map((s) => s.id) } } }),
    prisma.assignment.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return NextResponse.json({ removed: ids.length, kept, submissionsRemoved: subs.length });
}
