import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 학생의 활성 반에 배정된 과제 목록 + 본인 제출 상태
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.studentId, status: "active" },
    select: { classId: true },
  });
  const classIds = enrollments.map((e) => e.classId);
  if (classIds.length === 0) return NextResponse.json({ assignments: [] });

  const assignments = await prisma.assignment.findMany({
    where: { classId: { in: classIds }, active: true },
    include: {
      assessment: { select: { id: true, subject: true, type: true, title: true } },
      class: { select: { id: true, name: true } },
      submissions: {
        where: { studentId: student.studentId },
        select: {
          id: true,
          status: true,
          score: true,
          totalPoints: true,
          submittedAt: true,
        },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const result = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    dueAt: a.dueAt,
    subject: a.assessment.subject,
    className: a.class.name,
    submission: a.submissions[0] || null,
  }));

  return NextResponse.json({ assignments: result });
}
