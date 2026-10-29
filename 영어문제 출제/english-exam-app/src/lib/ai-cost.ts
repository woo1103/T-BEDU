// AI 사용량 → 금액 계산(관리자 'AI 사용량' 화면). 단가는 Anthropic 공개 가격(100만 토큰당 달러).
export type AiKind = "generate" | "verify" | "grade" | "answerKey" | "mathExtract";

export const AI_KIND_LABEL: Record<AiKind, string> = {
  generate: "문제 만들기",
  verify: "문제 검수(풀어 보기)",
  grade: "서술형 채점",
  answerKey: "정답지 읽기",
  mathExtract: "수학 문제 인식",
};

interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const PRICES: Record<string, Price> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};
// 모르는 모델이면 Sonnet 단가로 어림한다(과소 계산 방지)
const FALLBACK = PRICES["claude-sonnet-4-6"];

// 원화 표시는 어림값
export const KRW_PER_USD = 1400;

export interface UsageRow {
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export function costUsd(r: UsageRow): number {
  const p = PRICES[r.model] ?? FALLBACK;
  return (
    (r.inputTokens * p.input +
      r.outputTokens * p.output +
      r.cacheWriteTokens * p.cacheWrite +
      r.cacheReadTokens * p.cacheRead) /
    1_000_000
  );
}

export interface KindSummary {
  kind: string;
  label: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

export function summarize(rows: UsageRow[]): { byKind: KindSummary[]; calls: number; usd: number } {
  const map = new Map<string, KindSummary>();
  for (const r of rows) {
    const s =
      map.get(r.kind) ??
      {
        kind: r.kind,
        label: AI_KIND_LABEL[r.kind as AiKind] ?? r.kind,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        usd: 0,
      };
    s.calls += 1;
    s.inputTokens += r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens;
    s.outputTokens += r.outputTokens;
    s.usd += costUsd(r);
    map.set(r.kind, s);
  }
  const byKind = [...map.values()].sort((a, b) => b.usd - a.usd);
  return {
    byKind,
    calls: byKind.reduce((n, s) => n + s.calls, 0),
    usd: byKind.reduce((n, s) => n + s.usd, 0),
  };
}
