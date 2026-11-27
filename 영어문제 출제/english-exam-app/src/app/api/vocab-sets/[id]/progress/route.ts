import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 이 세트를 배정한 반의 학생별 학습 현황 + 자주 틀린 단어
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const set = await prisma.vocabSet.findUnique({
    where: { id },
    select: {
      _count: { select: { words: true } },
      assignments: { select: { class: { select: { id: true, name: true } } } },
    },
  });
  if (!set) return NextResponse.json({ error: "세트를 찾을 수 없어요" }, { status: 404 });

  const classIds = set.assignments.map((a) => a.class.id);
  const enrollments = classIds.length
    ? await prisma.enrollment.findMany({
        where: { classId: { in: classIds }, status: "active" },
        select: { classId: true, student: { select: { id: true, name: true } } },
      })
    : [];
  const progress = await prisma.vocabProgress.findMany({
    where: { setId: id },
    select: { studentId: true, wordId: true, correct: true, wrong: true, known: true, updatedAt: true },
  });

  type Sum = { studied: number; known: number; correct: number; wrong: number; last: Date | null };
  const empty = (): Sum => ({ studied: 0, known: 0, correct: 0, wrong: 0, last: null });
  const byStudent = new Map<string, Sum>();
  const wrongByWord = new Map<string, number>();
  for (const p of progress) {
    const s = byStudent.get(p.studentId) ?? empty();
    s.studied++;
    if (p.known) s.known++;
    s.correct += p.correct;
    s.wrong += p.wrong;
    if (!s.last || p.updatedAt > s.last) s.last = p.updatedAt;
    byStudent.set(p.studentId, s);
    if (p.wrong > 0) wrongByWord.set(p.wordId, (wrongByWord.get(p.wordId) ?? 0) + p.wrong);
  }
  const topWrong = [...wrongByWord].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const words = topWrong.length
    ? await prisma.vocabWord.findMany({
        where: { id: { in: topWrong.map(([w]) => w) } },
        select: { id: true, word: true, meaning: true },
      })
    : [];
  const wordMap = new Map(words.map((w) => [w.id, w]));

  return NextResponse.json({
    total: set._count.words,
    classes: set.assignments.map((a) => ({
      ...a.class,
      students: enrollments
        .filter((e) => e.classId === a.class.id)
        .map((e) => ({ id: e.student.id, name: e.student.name, ...(byStudent.get(e.student.id) ?? empty()) })),
    })),
    topWrong: topWrong
      .map(([wid, n]) => ({ ...wordMap.get(wid), wrong: n }))
      .filter((w) => w.word),
  });
}
