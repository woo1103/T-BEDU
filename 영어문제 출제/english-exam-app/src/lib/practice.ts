// 오답노트 "비슷한 문제 다시 풀기": 같은 유형의 검수 통과 문제를 은행에서 고르고,
// 없으면 하루 한도 안에서 AI로 변형을 만들어 은행에도 저장한다.
import { prisma } from "@/lib/db";
import { generateVerifiedQuestion } from "@/lib/generate-core";
import { isWritingType, normalizeMarkerChoices } from "@/lib/passage-parser";
import { isSetLeadType, isSetMemberType } from "@/lib/question-types";

export const DAILY_AI_LIMIT = 5; // 학생 1명당 하루에 AI로 새로 만드는 문제 수
const CIRCLE = ["①", "②", "③", "④", "⑤"];

// 한국 시간 오늘 0시
export function kstDayStart(now = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000);
}

// 학생이 이미 본 문제(시험·과제에서 답했거나, 비슷한 문제로 받은 것)는 빼고 무작위로 하나
export function pickUnseen<T extends { id: string }>(candidates: T[], seen: Set<string>, rnd = Math.random): T | null {
  const fresh = candidates.filter((c) => !seen.has(c.id));
  return fresh.length ? fresh[Math.floor(rnd() * fresh.length)] : null;
}

type SimilarResult =
  | { ok: true; questionId: string; generated: boolean }
  | { ok: false; reason: string };

export async function findOrMakeSimilar(studentId: string, originalId: string): Promise<SimilarResult> {
  const original = await prisma.question.findUnique({
    where: { id: originalId },
    include: { passageRef: { select: { content: true } } },
  });
  if (!original) return { ok: false, reason: "원래 문제를 찾을 수 없어요." };
  if (isWritingType(original.questionType)) return { ok: false, reason: "서술형은 비슷한 문제 풀기를 지원하지 않아요." };

  const [answered, practiced] = await Promise.all([
    prisma.answer.findMany({ where: { refType: "question", submission: { studentId } }, select: { refId: true } }),
    prisma.practiceAttempt.findMany({ where: { studentId }, select: { questionId: true } }),
  ]);
  const seen = new Set([originalId, ...answered.map((a) => a.refId), ...practiced.map((p) => p.questionId)]);

  const candidates = await prisma.question.findMany({
    where: { questionType: original.questionType, verifyStatus: "ok", id: { not: originalId } },
    select: { id: true },
    take: 300,
  });
  const picked = pickUnseen(candidates, seen);
  if (picked) return { ok: true, questionId: picked.id, generated: false };

  // 장문 세트 문항은 혼자 만들 수 없다(세트 단위 생성)
  if (isSetLeadType(original.questionType) || isSetMemberType(original.questionType)) {
    return { ok: false, reason: "아직 비슷한 문제가 없어요. 선생님께 장문 세트를 더 만들어 달라고 해 주세요." };
  }

  const usedToday = await prisma.practiceAttempt.count({
    where: { studentId, generated: true, createdAt: { gte: kstDayStart() } },
  });
  if (usedToday >= DAILY_AI_LIMIT) {
    return { ok: false, reason: `오늘은 새 문제를 ${DAILY_AI_LIMIT}개까지 만들 수 있어요. 내일 다시 해 보세요.` };
  }

  // 교과서 지문 문제면 같은 지문을 바꿔 쓰고, 아니면 같은 유형으로 새 지문
  const out = await generateVerifiedQuestion({
    examType: original.examType,
    questionType: original.questionType,
    difficulty: original.difficulty,
    sourcePassage: original.passageRef?.content ?? undefined,
    passageMode: original.passageRef ? "variant" : undefined,
    priorQuestions: [
      {
        question: `${original.question}\n    지문 첫머리: ${original.passage.replace(/\s+/g, " ").slice(0, 120)}`,
        answer: original.answer || undefined,
      },
    ],
  });
  if (!out.ok || !out.verified) {
    return { ok: false, reason: "비슷한 문제를 만들지 못했어요. 잠시 뒤 다시 해 보세요." };
  }
  const r = out.result;
  const choices = r.choices.map((c, i) => ({ label: CIRCLE[i] ?? `(${i + 1})`, text: c.text, isCorrect: c.isCorrect }));
  const q = await prisma.question.create({
    data: {
      examType: original.examType,
      questionType: original.questionType,
      points: r.points || original.points,
      passage: r.passage,
      question: r.question,
      choices: JSON.stringify(choices),
      answer: choices.find((c) => c.isCorrect)?.label ?? r.answer,
      explanation: r.explanation || null,
      difficulty: original.difficulty,
      aiGenerated: true,
      source: "AI 생성 (오답 복습)",
      passageId: original.passageId,
      verifyStatus: "ok",
      verifiedAt: new Date(),
    },
  });
  return { ok: true, questionId: q.id, generated: true };
}

// 학생에게 보낼 문제(정답 표시 없이)
export function toStudentQuestion(q: { passage: string; question: string; questionType: string; choices: string }) {
  let choices: { label: string; text: string }[] = [];
  try {
    const parsed = JSON.parse(q.choices) as { label: string; text: string; isCorrect: boolean }[];
    choices = normalizeMarkerChoices(parsed).map((c) => ({ label: c.label, text: c.text }));
  } catch {
    /* 빈 선지 */
  }
  return { passage: q.passage, question: q.question, questionType: q.questionType, choices };
}
