import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, canAccessClass } from "@/lib/api-auth";
import { isTarget, targetsWithout } from "@/lib/assignment-targets";

// 과제에서 한 학생만 빼기. 그 학생의 제출 기록도 지운다. 남는 학생이 없으면 과제 자체를 지운다.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id, studentId } = await params;
  const asg = await prisma.assignment.findUnique({ where: { id }, select: { classId: true, studentIds: true } });
  if (!asg) return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  if (!(await canAccessClass(staff, asg.classId))) {
    return NextResponse.json({ error: "담당 반이 아닙니다" }, { status: 403 });
  }
  if (!isTarget(asg.studentIds, studentId)) {
    return NextResponse.json({ error: "이 과제를 받은 학생이 아닙니다" }, { status: 404 });
  }

  const enr = await prisma.enrollment.findMany({
    where: { classId: asg.classId, status: "active" },
    select: { studentId: true },
  });
  const remaining = targetsWithout(asg.studentIds, enr.map((e) => e.studentId), studentId);

  // 그 학생의 제출 기록(답·오답노트는 함께 지워짐) + 성취도 스냅샷
  const subs = await prisma.submission.findMany({ where: { assignmentId: id, studentId }, select: { id: true } });
  const subIds = subs.map((s) => s.id);

  if (remaining.length === 0) {
    const allSubs = await prisma.submission.findMany({ where: { assignmentId: id }, select: { id: true } });
    await prisma.$transaction([
      prisma.achievementSnapshot.deleteMany({ where: { submissionId: { in: allSubs.map((s) => s.id) } } }),
      prisma.assignment.delete({ where: { id } }),
    ]);
    return NextResponse.json({ removed: true, deletedAssignment: true });
  }

  await prisma.$transaction([
    prisma.achievementSnapshot.deleteMany({ where: { submissionId: { in: subIds } } }),
    prisma.submission.deleteMany({ where: { id: { in: subIds } } }),
    prisma.assignment.update({ where: { id }, data: { studentIds: JSON.stringify(remaining) } }),
  ]);
  return NextResponse.json({ removed: true, deletedAssignment: false, remaining: remaining.length });
}
