// 시험지 자동 구성: 문제 은행에서 고르는 규칙과 원클릭 구성(프리셋)
import { SUNEUNG_TYPES } from "@/lib/question-types";

export interface BankQuestion {
  id: string;
  questionType: string;
  verifyStatus?: string | null;
  passageRef?: { grade: string } | null;
  examItems?: unknown[];
}

// 유형 하나에서 count개를 고른다.
// - 검수에서 '문제 있음'으로 나온 문항은 쓰지 않는다
// - 학년이 맞는 문항 → (허용하면) 학년 정보가 없는 문항 순
// - 같은 조건이면 아직 시험지에 안 쓴 문항, 그다음 검수 통과 문항을 먼저
export function pickFromBank<T extends BankQuestion>(
  bank: T[],
  code: string,
  count: number,
  opts: { grade: string; allowNoGrade: boolean; exclude: Set<string> }
): T[] {
  const rank = (q: T) => {
    const gradeRank = q.passageRef?.grade === opts.grade ? 0 : 1;
    const unusedRank = (q.examItems?.length ?? 0) === 0 ? 0 : 1;
    const verifiedRank = q.verifyStatus === "ok" ? 0 : 1;
    return gradeRank * 4 + unusedRank * 2 + verifiedRank;
  };
  return bank
    .filter(
      (q) =>
        q.questionType === code &&
        !opts.exclude.has(q.id) &&
        q.verifyStatus !== "error" &&
        (q.passageRef?.grade === opts.grade || (opts.allowNoGrade && !q.passageRef?.grade))
    )
    .map((q, i) => ({ q, r: rank(q), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, count)
    .map((x) => x.q);
}

export interface ComposePreset {
  key: string;
  label: string;
  desc: string;
  types: { code: string; count: number }[];
}

const suneungRange = (from: number, to: number) =>
  SUNEUNG_TYPES.filter((t) => typeof t.number === "number" && t.number >= from && t.number <= to).map((t) => ({
    code: t.code,
    count: 1,
  }));

export const SUNEUNG_PRESETS: ComposePreset[] = [
  {
    key: "reading-all",
    label: "수능형 독해 18~40번",
    desc: "번호 순서대로 23문항",
    types: suneungRange(18, 40),
  },
  {
    key: "hard",
    label: "고난도 집중",
    desc: "밑줄·어법·빈칸·순서·삽입 10문항",
    types: ["21_underline", "29_grammar", "31_blank_vocab", "32_blank_sent", "33_blank_sent2", "34_blank_sent3", "36_order", "37_order2", "38_insertion", "39_insertion2"].map(
      (code) => ({ code, count: 1 })
    ),
  },
  {
    key: "main-idea",
    label: "대의 파악",
    desc: "목적·심경·주장·요지·주제·제목 6문항",
    types: suneungRange(18, 24).filter((t) => t.code !== "21_underline"),
  },
];
