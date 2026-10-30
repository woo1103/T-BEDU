import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { findOrMakeSimilar, toStudentQuestion } from "@/lib/practice";

// 은행에 없으면 AI로 만들고 검수까지 하므로 넉넉히
export const maxDuration = 180;

// 오답 하나에 대해 비슷한 문제 받기. body: { wrongNoteId }
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.wrongNoteId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  const note = await prisma.wrongNote.findUnique({
    where: { id: body.wrongNoteId },
    include: { answer: { select: { refType: true, refId: true } } },
  });
  if (!note || note.studentId !== student.studentId) {
    return NextResponse.json({ error: "오답을 찾을 수 없습니다" }, { status: 404 });
  }
  if (note.answer.refType !== "question") {
    return NextResponse.json({ none: true, reason: "이 문제는 비슷한 문제 풀기를 지원하지 않아요." });
  }

  const found = await findOrMakeSimilar(student.studentId, note.answer.refId);
  if (!found.ok) return NextResponse.json({ none: true, reason: found.reason });

  const q = await prisma.question.findUnique({ where: { id: found.questionId } });
  if (!q) return NextResponse.json({ none: true, reason: "문제를 불러오지 못했어요." });
  const attempt = await prisma.practiceAttempt.create({
    data: {
      studentId: student.studentId,
      wrongNoteId: note.id,
      questionId: q.id,
      generated: found.generated,
    },
  });
  return NextResponse.json({ attemptId: attempt.id, generated: found.generated, ...toStudentQuestion(q) });
}
