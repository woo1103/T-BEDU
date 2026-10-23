// 문항 독립 풀이 검수 — 판정(순수 함수), 저장 문항 검수, 검수 통과 서명.
import { createHmac } from "node:crypto";
import { solveQuestion } from "@/lib/claude";
import { normalizeMarkerChoices } from "@/lib/passage-parser";

export type VerifyStatus = "ok" | "suspect" | "error";

const CIRCLE = ["①", "②", "③", "④", "⑤"];

export interface SolveResult {
  answerIndex: number;
  valid: "one" | "none" | "multiple";
  reason: string;
}

// 검수자 풀이와 출제 정답 비교 → 통과 여부와 사람이 읽을 사유
export function judgeSolve(intended: number, solved: SolveResult): { ok: boolean; note: string } {
  if (solved.valid === "one" && solved.answerIndex === intended) return { ok: true, note: "" };
  const what =
    solved.valid === "none"
      ? "어느 선지도 정답이 될 수 없음"
      : solved.valid === "multiple"
      ? "정답이 될 수 있는 선지가 2개 이상"
      : `검수자는 ${CIRCLE[solved.answerIndex] ?? "?"}를 정답으로 판단(출제 정답 ${CIRCLE[intended] ?? "?"})`;
  return { ok: false, note: solved.reason ? `${what}. 근거: ${solved.reason}` : what };
}

interface ChoiceLike {
  label?: string;
  text?: string;
  isCorrect?: boolean;
}

// 저장된 문항(choices는 JSON 문자열) 검수. 정답 표시 자체가 틀리면 AI 호출 없이 의심 처리.
export async function verifyStoredQuestion(q: {
  passage: string;
  question: string;
  choices: string;
}): Promise<{ status: VerifyStatus; note: string }> {
  let raw: ChoiceLike[];
  try {
    raw = JSON.parse(q.choices) as ChoiceLike[];
  } catch {
    return { status: "suspect", note: "선지 데이터가 깨져 읽을 수 없음" };
  }
  if (!Array.isArray(raw) || raw.length < 2) return { status: "suspect", note: "선지가 없음" };
  const choices = normalizeMarkerChoices(
    raw.map((c, i) => ({ label: c.label ?? CIRCLE[i] ?? "", text: c.text ?? "", isCorrect: !!c.isCorrect }))
  );
  const flagged = choices.filter((c) => c.isCorrect).length;
  if (flagged !== 1) return { status: "suspect", note: flagged === 0 ? "정답 표시 없음" : `정답 표시 ${flagged}개` };

  try {
    const solved = await solveQuestion({
      passage: q.passage,
      question: q.question,
      choices: choices.map((c) => c.text),
    });
    const verdict = judgeSolve(choices.findIndex((c) => c.isCorrect), solved);
    return verdict.ok ? { status: "ok", note: "" } : { status: "suspect", note: verdict.note };
  } catch (e) {
    return { status: "error", note: e instanceof Error ? e.message : "검수 호출 실패" };
  }
}

// ── 검수 통과 서명 ──
// 생성 API가 검수를 통과한 "그 내용"에만 서명을 붙이고, 저장 API가 같은 내용인지 다시 계산해 확인한다.
// 저장 전에 선생님이 고치면 서명이 맞지 않아 '미검수'로 저장된다.
function canonical(q: { passage: string; question: string; choices: ChoiceLike[] }): string {
  return JSON.stringify([q.passage ?? "", q.question ?? "", (q.choices ?? []).map((c) => [c.text ?? "", !!c.isCorrect])]);
}

export function signVerified(q: { passage: string; question: string; choices: ChoiceLike[] }): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", `verify:${secret}`).update(canonical(q)).digest("hex");
}

export function isVerifiedSignature(
  q: { passage: string; question: string; choices: ChoiceLike[] },
  sig: unknown
): boolean {
  return typeof sig === "string" && sig.length === 64 && sig === signVerified(q);
}
