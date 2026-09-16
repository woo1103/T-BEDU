import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { correctLabel } from "@/lib/grading";

// 학생 오답노트 목록 (기본: 미완료만, ?all=1 이면 전체)
export async function GET(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const includeResolved = searchParams.get("all") === "1";

  const notes = await prisma.wrongNote.findMany({
    where: {
      studentId: student.studentId,
      ...(includeResolved ? {} : { resolved: false }),
    },
    include: { answer: true },
    orderBy: { createdAt: "desc" },
  });

  const qIds = [...new Set(notes.map((n) => n.answer.refId))];
  const questions = await prisma.question.findMany({
    where: { id: { in: qIds } },
    select: {
      id: true,
      passage: true,
      question: true,
      choices: true,
      answer: true,
      explanation: true,
    },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const result = notes.map((n) => {
    const q = qMap.get(n.answer.refId);
    let choices: { label: string; text: string }[] = [];
    if (q) {
      try {
        choices = (JSON.parse(q.choices) as { label: string; text: string }[]).map(
          (c) => ({ label: c.label, text: c.text })
        );
      } catch {
        /* empty */
      }
    }
    return {
      id: n.id,
      note: n.note,
      resolved: n.resolved,
      createdAt: n.createdAt,
      selected: n.answer.selected,
      question: q
        ? {
            question: q.question,
            passage: q.passage,
            choices,
            correct: correctLabel(q),
            explanation: q.explanation,
          }
        : null,
    };
  });

  return NextResponse.json({ notes: result });
}
