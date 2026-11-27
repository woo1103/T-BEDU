import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

type Ctx = { params: Promise<{ setId: string }> };

// 내 반에 배정된 세트인지 확인
async function allowed(studentId: string, setId: string): Promise<boolean> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "active" },
    select: { classId: true },
  });
  if (enrollments.length === 0) return false;
  const a = await prisma.vocabAssignment.findFirst({
    where: { setId, classId: { in: enrollments.map((e) => e.classId) } },
    select: { id: true },
  });
  return !!a;
}

// 세트의 단어 + 단어별 내 기록
export async function GET(request: NextRequest, { params }: Ctx) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { setId } = await params;
  if (!(await allowed(student.studentId, setId))) return NextResponse.json({ error: "배정되지 않은 단어 세트예요" }, { status: 403 });

  const set = await prisma.vocabSet.findUnique({
    where: { id: setId },
    select: { id: true, title: true, words: { orderBy: { order: "asc" }, select: { id: true, order: true, word: true, meaning: true, example: true } } },
  });
  if (!set) return NextResponse.json({ error: "세트를 찾을 수 없어요" }, { status: 404 });
  const progress = await prisma.vocabProgress.findMany({
    where: { studentId: student.studentId, setId },
    select: { wordId: true, correct: true, wrong: true, known: true },
  });
  const pm = new Map(progress.map((p) => [p.wordId, p]));
  return NextResponse.json({
    id: set.id,
    title: set.title,
    words: set.words.map((w) => {
      const p = pm.get(w.id);
      return { ...w, correct: p?.correct ?? 0, wrong: p?.wrong ?? 0, known: p?.known ?? false };
    }),
  });
}

// 학습 결과 저장. body: { results: [{ wordId, correct?: boolean, known?: boolean }] }
//  correct: 뜻 고르기에서 맞힘/틀림 → 횟수 더하기. 맞히면 외움, 틀리면 다시 못 외움(마지막 결과 기준)
//  known: 카드에서 "알아요/몰라요"
export async function POST(request: NextRequest, { params }: Ctx) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { setId } = await params;
  if (!(await allowed(student.studentId, setId))) return NextResponse.json({ error: "배정되지 않은 단어 세트예요" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const results: { wordId: string; correct?: boolean; known?: boolean }[] = Array.isArray(body?.results)
    ? body.results.filter((r: { wordId?: unknown }) => typeof r?.wordId === "string").slice(0, 500)
    : [];
  if (results.length === 0) return NextResponse.json({ ok: true, saved: 0 });

  // 이 세트의 단어만 받는다
  const valid = new Set(
    (
      await prisma.vocabWord.findMany({
        where: { setId, id: { in: [...new Set(results.map((r) => r.wordId))] } },
        select: { id: true },
      })
    ).map((w) => w.id)
  );
  const prev = await prisma.vocabProgress.findMany({
    where: { studentId: student.studentId, wordId: { in: [...valid] } },
  });
  const state = new Map(prev.map((p) => [p.wordId, { correct: p.correct, wrong: p.wrong, known: p.known }]));
  for (const r of results) {
    if (!valid.has(r.wordId)) continue;
    const s = state.get(r.wordId) ?? { correct: 0, wrong: 0, known: false };
    if (r.correct === true) {
      s.correct++;
      s.known = true;
    } else if (r.correct === false) {
      s.wrong++;
      s.known = false;
    }
    if (typeof r.known === "boolean") s.known = r.known;
    state.set(r.wordId, s);
  }
  await prisma.$transaction(
    [...state].map(([wordId, s]) =>
      prisma.vocabProgress.upsert({
        where: { studentId_wordId: { studentId: student.studentId, wordId } },
        create: { studentId: student.studentId, wordId, setId, correct: s.correct, wrong: s.wrong, known: s.known },
        update: { correct: s.correct, wrong: s.wrong, known: s.known },
      })
    )
  );
  return NextResponse.json({ ok: true, saved: state.size });
}
