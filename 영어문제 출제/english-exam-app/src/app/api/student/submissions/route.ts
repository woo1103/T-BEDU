import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import {
  buildMetas,
  gradeAndSave,
  loadAssignment,
  reconstructResults,
  resultPayload,
} from "@/lib/submission-grade";

// 이미 제출한 과제의 결과 조회 (재채점 없이). GET ?assignmentId=
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const assignmentId = new URL(request.url).searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId가 필요합니다" }, { status: 400 });
  }
  const assignment = await loadAssignment(assignmentId);
  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  }
  const submission = await prisma.submission.findFirst({
    where: { studentId: student.studentId, assignmentId },
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
  if (!submission) {
    return NextResponse.json({ submitted: false });
  }
  const metas = buildMetas(assignment);
  const results = reconstructResults(metas, submission.answers);
  return NextResponse.json({ submitted: true, ...resultPayload(submission, results, true) });
}

// 학생 마킹 제출 → 자동 채점 (영어 시험지 / 수학 문제지 공통).
// body: { assignmentId, answers: [{questionId|refId, selected}] }
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const assignment = await loadAssignment(body.assignmentId);
  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  }

  const enrolled = await prisma.enrollment.findFirst({
    where: {
      studentId: student.studentId,
      classId: assignment.classId,
      status: "active",
    },
  });
  if (!enrolled) {
    return NextResponse.json({ error: "이 과제에 접근할 수 없습니다" }, { status: 403 });
  }
  // 지정 학생 과제면 대상자만 제출 가능
  if (assignment.studentIds) {
    try {
      const ids = JSON.parse(assignment.studentIds) as string[];
      if (Array.isArray(ids) && ids.length > 0 && !ids.includes(student.studentId)) {
        return NextResponse.json({ error: "배정 대상이 아닙니다" }, { status: 403 });
      }
    } catch {
      /* ignore */
    }
  }

  const metas = buildMetas(assignment);

  // #5 재채점 방지: 이미 제출한 과제면 재채점하지 않고 기존 결과를 그대로 반환.
  const existing = await prisma.submission.findFirst({
    where: { studentId: student.studentId, assignmentId: assignment.id },
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
  if (existing) {
    const results = reconstructResults(metas, existing.answers);
    return NextResponse.json(resultPayload(existing, results, true), { status: 200 });
  }

  // 학생 답: refId 또는 questionId 키 모두 허용
  const selectedByRef = new Map<string, string>();
  for (const a of body.answers) {
    const key =
      typeof a?.refId === "string"
        ? a.refId
        : typeof a?.questionId === "string"
        ? a.questionId
        : null;
    if (key && typeof a.selected === "string" && !selectedByRef.has(key)) {
      selectedByRef.set(key, a.selected);
    }
  }

  const payload = await gradeAndSave(assignment, student.studentId, selectedByRef);
  return NextResponse.json(payload, { status: 201 });
}
