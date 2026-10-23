import { describe, expect, it } from "vitest";
import { distribution, isSkewed, moveCorrect, planBalance } from "@/lib/answer-balance";

describe("정답 분포", () => {
  it("번호별 개수", () => {
    expect(distribution([0, 2, 2, 4])).toEqual([1, 0, 2, 0, 1]);
  });
  it("쏠림: 차이 3 이상 또는 한 번호 40% 초과", () => {
    expect(isSkewed([4, 1, 1, 1, 1])).toBe(true); // 4/8 = 50%
    expect(isSkewed([2, 2, 2, 2, 2])).toBe(false);
    expect(isSkewed([3, 0, 0, 0, 0])).toBe(false); // 5문항 미만은 판단 안 함
  });
});

describe("고르게 섞기 계획", () => {
  it("옮길 수 있는 문항만 옮겨 차이를 1 이하로", () => {
    const pos = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    const next = planBalance(pos, pos.map(() => true));
    const d = distribution(next);
    expect(Math.max(...d) - Math.min(...d)).toBeLessThanOrEqual(1);
  });
  it("옮길 수 없는 문항은 그대로", () => {
    const pos = [2, 2, 2, 2, 2, 2];
    const movable = [false, false, false, true, false, false];
    const next = planBalance(pos, movable);
    next.forEach((p, i) => {
      if (!movable[i]) expect(p).toBe(2);
    });
    expect(next[3]).not.toBe(2);
  });
  it("이미 고르면 아무것도 안 바꾼다", () => {
    const pos = [0, 1, 2, 3, 4, 0, 1];
    expect(planBalance(pos, pos.map(() => true))).toEqual(pos);
  });
});

describe("정답 선지 옮기기", () => {
  it("두 자리만 맞바꾸고 나머지 순서는 유지", () => {
    expect(moveCorrect(["a", "b", "C", "d", "e"], 2, 0)).toEqual(["C", "b", "a", "d", "e"]);
  });
});
