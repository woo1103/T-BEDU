import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { correctLabel, isAnswerCorrect } from "@/lib/grading";

// 비슷한 문제 채점. 맞히면 그 오답은 복습 완료. body: { attemptId, selected }
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.attemptId !== "string" || typeof body?.selected !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  const attempt = await prisma.practiceAttempt.findUnique({ where: { id: body.attemptId } });
  if (!attempt || attempt.studentId !== student.studentId) {
    return NextResponse.json({ error: "문제를 찾을 수 없습니다" }, { status: 404 });
  }
  const q = await prisma.question.findUnique({ where: { id: attempt.questionId } });
  if (!q) return NextResponse.json({ error: "문제를 찾을 수 없습니다" }, { status: 404 });

  const correct = correctLabel(q) ?? "";
  const ok = isAnswerCorrect(body.selected, correct);
  // 한 번 채점한 문제는 다시 채점하지 않는다(답 바꿔 가며 맞히기 방지)
  if (attempt.answeredAt == null) {
    await prisma.practiceAttempt.update({
      where: { id: attempt.id },
      data: { selected: body.selected, isCorrect: ok, answeredAt: new Date() },
    });
    if (ok) {
      await prisma.wrongNote.updateMany({
        where: { id: attempt.wrongNoteId, studentId: student.studentId },
        data: { resolved: true },
      });
    }
  }
  return NextResponse.json({
    correct: attempt.answeredAt == null ? ok : attempt.isCorrect === true,
    correctLabel: correct,
    explanation: q.explanation,
    resolved: attempt.answeredAt == null ? ok : attempt.isCorrect === true,
  });
}
