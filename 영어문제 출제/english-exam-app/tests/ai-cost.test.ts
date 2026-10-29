import { describe, expect, it } from "vitest";
import { costUsd, summarize } from "@/lib/ai-cost";

const row = (kind: string, i: number, o: number, w = 0, r = 0) => ({
  kind,
  model: "claude-sonnet-4-6",
  inputTokens: i,
  outputTokens: o,
  cacheWriteTokens: w,
  cacheReadTokens: r,
});

describe("AI 비용 계산", () => {
  it("Sonnet 4.6 단가: 입력 $3, 출력 $15, 캐시 쓰기 $3.75, 읽기 $0.30 (100만 토큰당)", () => {
    expect(costUsd(row("generate", 1_000_000, 0))).toBeCloseTo(3);
    expect(costUsd(row("generate", 0, 1_000_000))).toBeCloseTo(15);
    expect(costUsd(row("generate", 0, 0, 1_000_000, 1_000_000))).toBeCloseTo(4.05);
  });

  it("모르는 모델은 Sonnet 단가로 어림", () => {
    expect(costUsd({ ...row("x", 1_000_000, 0), model: "unknown" })).toBeCloseTo(3);
  });

  it("작업별로 묶고 비싼 순으로 정렬", () => {
    const s = summarize([row("verify", 1000, 100), row("generate", 2000, 1000), row("generate", 2000, 1000)]);
    expect(s.calls).toBe(3);
    expect(s.byKind.map((k) => k.kind)).toEqual(["generate", "verify"]);
    expect(s.byKind[0]).toMatchObject({ calls: 2, inputTokens: 4000, outputTokens: 2000, label: "문제 만들기" });
    expect(s.usd).toBeCloseTo((4000 * 3 + 2000 * 15 + 1000 * 3 + 100 * 15) / 1e6);
  });
});
