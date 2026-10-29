import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, canAccessClass } from "@/lib/api-auth";
import { buildMetas, gradeAndSave, loadAssignment } from "@/lib/submission-grade";
import { itemStats } from "@/lib/omr";

// 종이 시험 답 입력(선생님): 반 학생 목록 + 문항 + 지금까지의 채점 결과·통계
async function loadForStaff(id: string) {
  const staff = await requireStaff();
  if (!staff) return { error: NextResponse.json({ error: "권한 없음" }, { status: 403 }) };
  const assignment = await loadAssignment(id);
  if (!assignment) return { error: NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 }) };
  if (!(await canAccessClass(staff, assignment.classId))) {
    return { error: NextResponse.json({ error: "담당 반이 아닙니다" }, { status: 403 }) };
  }
  return { assignment };
}

// 배정 대상 학생(지정 학생 과제면 그 학생만)
async function roster(classId: string, studentIds: string | null) {
  let only: string[] | null = null;
  try {
    const ids = studentIds ? (JSON.parse(studentIds) as string[]) : null;
    if (Array.isArray(ids) && ids.length > 0) only = ids;
  } catch {
    /* 반 전체 */
  }
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "active", ...(only ? { studentId: { in: only } } : {}) },
    include: { student: { select: { id: true, name: true } } },
  });
  return enrollments.map((e) => e.student).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { assignment, error } = await loadForStaff(id);
  if (error) return error;

  const metas = buildMetas(assignment);
  const [students, submissions, cls] = await Promise.all([
    roster(assignment.classId, assignment.studentIds),
    prisma.submission.findMany({
      where: { assignmentId: id },
      orderBy: { submittedAt: "desc" },
      include: { answers: true },
    }),
    prisma.class.findUnique({ where: { id: assignment.classId }, select: { name: true } }),
  ]);

  // 학생마다 가장 최근 제출 하나
  const latest = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) if (!latest.has(s.studentId)) latest.set(s.studentId, s);
  const graded = [...latest.values()];
  const scores = graded.map((s) => s.score);

  return NextResponse.json({
    assignment: {
      id: assignment.id,
      title: assignment.title,
      className: cls?.name ?? "",
      examId: assignment.assessment.examId,
    },
    items: metas.map((m) => ({
      refId: m.refId,
      label: m.label,
      correct: m.correct,
      maxPoints: m.maxPoints,
      writing: m.writing,
      choice: m.choice,
    })),
    students: students.map((st) => {
      const sub = latest.get(st.id);
      const byRef = new Map(sub?.answers.map((a) => [a.refId, a]) ?? []);
      return {
        id: st.id,
        name: st.name,
        submission: sub
          ? {
              score: sub.score,
              totalPoints: sub.totalPoints,
              correctCount: sub.correctCount,
              selected: metas.map((m) => byRef.get(m.refId)?.selected ?? ""),
              points: metas.map((m) => byRef.get(m.refId)?.points ?? 0),
              isCorrect: metas.map((m) => byRef.get(m.refId)?.isCorrect ?? false),
            }
          : null,
      };
    }),
    summary: {
      count: graded.length,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
      max: scores.length ? Math.max(...scores) : 0,
      min: scores.length ? Math.min(...scores) : 0,
      totalPoints: metas.reduce((n, m) => n + m.maxPoints, 0),
    },
    stats: itemStats(metas, graded),
  });
}

// 학생 한 명의 종이 답 저장 → 학생 앱 제출과 같은 규칙으로 채점.
// body: { studentId, selected: string[](문항 순서), writingPoints: (number|null)[], replace?: boolean }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { assignment, error } = await loadForStaff(id);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.studentId !== "string" || !Array.isArray(body.selected)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  const students = await roster(assignment.classId, assignment.studentIds);
  if (!students.some((s) => s.id === body.studentId)) {
    return NextResponse.json({ error: "이 과제를 받은 학생이 아닙니다" }, { status: 400 });
  }

  const existing = await prisma.submission.findMany({
    where: { assignmentId: id, studentId: body.studentId },
    select: { id: true },
  });
  if (existing.length > 0) {
    if (!body.replace) {
      return NextResponse.json({ error: "이미 답이 들어간 학생이에요. 고쳐서 다시 저장할까요?", exists: true }, { status: 409 });
    }
    // 고쳐 저장: 이전 채점 기록(답·오답노트·성취도 스냅샷)을 지우고 새로 채점
    const ids = existing.map((s) => s.id);
    await prisma.$transaction([
      prisma.achievementSnapshot.deleteMany({ where: { submissionId: { in: ids } } }),
      prisma.submission.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  const metas = buildMetas(assignment);
  const selectedByRef = new Map<string, string>();
  const writingPoints = new Map<string, number>();
  metas.forEach((m, i) => {
    const sel = body.selected[i];
    if (typeof sel === "string") selectedByRef.set(m.refId, sel.trim());
    const pts = Array.isArray(body.writingPoints) ? body.writingPoints[i] : null;
    if (m.writing && typeof pts === "number" && Number.isFinite(pts)) writingPoints.set(m.refId, pts);
  });

  const result = await gradeAndSave(assignment, body.studentId, selectedByRef, { writingPoints });
  return NextResponse.json(result, { status: 201 });
}
