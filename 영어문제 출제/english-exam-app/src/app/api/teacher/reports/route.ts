import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, isAdmin, canAccessClass } from "@/lib/api-auth";
import { isValidMonth, loadMonthlyReports } from "@/lib/monthly-report";

export const maxDuration = 60;

// 학부모 월간 리포트 자료. ?month=2026-10 & (studentId=… | classId=…)
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const month = sp.get("month");
  if (!isValidMonth(month)) return NextResponse.json({ error: "month는 2026-10 형식이어야 합니다" }, { status: 400 });

  let ids: string[] = [];
  const studentId = sp.get("studentId");
  const classId = sp.get("classId");
  if (studentId) {
    // 담당자는 본인 담당반 학생만
    if (!isAdmin(staff)) {
      const owned = await prisma.enrollment.findFirst({
        where: { studentId, class: { teacherId: staff.sub } },
        select: { id: true },
      });
      if (!owned) return NextResponse.json({ error: "담당 학생이 아닙니다" }, { status: 403 });
    }
    ids = [studentId];
  } else if (classId) {
    if (!(await canAccessClass(staff, classId))) {
      return NextResponse.json({ error: "담당 반이 아닙니다" }, { status: 403 });
    }
    const enr = await prisma.enrollment.findMany({
      where: { classId, status: "active" },
      include: { student: { select: { id: true, name: true } } },
    });
    ids = enr.sort((a, b) => a.student.name.localeCompare(b.student.name, "ko")).map((e) => e.student.id);
  } else {
    return NextResponse.json({ error: "studentId 또는 classId가 필요합니다" }, { status: 400 });
  }

  const reports = await loadMonthlyReports(ids, month);
  return NextResponse.json({ month, reports });
}
