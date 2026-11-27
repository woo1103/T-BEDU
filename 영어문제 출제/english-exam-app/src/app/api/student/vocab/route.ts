import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 내 반에 배정된 단어 세트 + 세트별 내 진도(외운 단어 수)
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.studentId, status: "active" },
    select: { classId: true },
  });
  const classIds = enrollments.map((e) => e.classId);
  if (classIds.length === 0) return NextResponse.json({ sets: [] });

  const assigns = await prisma.vocabAssignment.findMany({
    where: { classId: { in: classIds } },
    orderBy: { createdAt: "desc" },
    select: { set: { select: { id: true, title: true, grade: true, _count: { select: { words: true } } } } },
  });
  const sets = [...new Map(assigns.map((a) => [a.set.id, a.set])).values()];
  const known = sets.length
    ? await prisma.vocabProgress.groupBy({
        by: ["setId"],
        where: { studentId: student.studentId, setId: { in: sets.map((s) => s.id) }, known: true },
        _count: { _all: true },
      })
    : [];
  const knownMap = new Map(known.map((k) => [k.setId, k._count._all]));
  return NextResponse.json({
    sets: sets.map((s) => ({ id: s.id, title: s.title, grade: s.grade, total: s._count.words, known: knownMap.get(s.id) ?? 0 })),
  });
}
