// 장문 세트(41~42, 43~45번) 묶기: 시험지 출력·미리보기·시험지 구성이 같은 규칙을 쓴다.
import { isSetLeadType, isSetMemberType } from "@/lib/question-types";

export interface SetLike {
  question: { passage: string; questionType: string; setId?: string | null };
}

function sameSet(a: SetLike["question"], b: SetLike["question"]): boolean {
  if (a.setId && b.setId) return a.setId === b.setId;
  // setId가 없던 예전 데이터: 세트 유형끼리 지문이 같으면 한 세트로
  return (
    (isSetLeadType(a.questionType) || isSetMemberType(a.questionType)) &&
    isSetMemberType(b.questionType) &&
    !!a.passage.trim() &&
    a.passage === b.passage
  );
}

// 연속한 같은 세트 문항을 한 묶음으로. 세트가 아니면 한 개짜리 묶음.
export function groupSetRuns<T extends SetLike>(items: T[]): { set: boolean; items: T[] }[] {
  const runs: { set: boolean; items: T[] }[] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    if (last && sameSet(last.items[last.items.length - 1].question, it.question)) {
      last.items.push(it);
      last.set = true;
    } else {
      runs.push({ set: false, items: [it] });
    }
  }
  return runs;
}

export interface BankLike {
  id: string;
  questionType: string;
  setId?: string | null;
}

// 고른 문항에 같은 세트의 나머지 문항을 번호 순으로 붙인다(세트는 항상 함께 들어가게)
export function withSetMembers<T extends BankLike>(picked: T[], bank: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const q of picked) {
    if (seen.has(q.id)) continue;
    const members = q.setId
      ? bank.filter((b) => b.setId === q.setId).sort((a, b) => a.questionType.localeCompare(b.questionType))
      : [q];
    for (const m of members.length ? members : [q]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
  }
  return out;
}

export const SET_HEAD = "다음 글을 읽고, 물음에 답하시오.";

// 세트 지문을 빈 줄 기준 문단으로 나눈다(단에 문단 단위로 흘려 넣기 위해 — 43~45번 (A)~(D) 등)
export function splitSetPassage(passage: string): string[] {
  const paras = (passage ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paras.length ? paras : [passage ?? ""];
}
