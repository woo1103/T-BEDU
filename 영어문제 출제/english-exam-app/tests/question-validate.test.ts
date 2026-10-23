import { describe, expect, it } from "vitest";
import { answerToIndex, reconcileCorrect, validateSingleAnswer } from "@/lib/question-validate";

const ch = (flags: boolean[]) => flags.map((f, i) => ({ text: `t${i}`, isCorrect: f }));

describe("answerToIndex", () => {
  it.each([
    ["③", 2],
    ["3", 2],
    ["(4)", 3],
    ["정답: ⑤", 4],
    ["In 2023", -1], // 범위 밖 숫자는 정답 번호가 아님
    ["", -1],
    ["(A) developed … (B) explore", -1],
  ])("%s → %i", (answer, idx) => {
    expect(answerToIndex(answer)).toBe(idx);
  });
});

describe("reconcileCorrect", () => {
  it("정답 표시가 없으면 answer 번호로 채운다", () => {
    expect(reconcileCorrect(ch([false, false, false, false, false]), "③").findIndex((c) => c.isCorrect)).toBe(2);
  });
  it("정답이 여러 개면 answer 번호 하나만 남긴다", () => {
    expect(reconcileCorrect(ch([true, true, false, false, false]), "②").filter((c) => c.isCorrect)).toHaveLength(1);
  });
  it("정답이 이미 하나면 그대로 둔다(answer와 달라도)", () => {
    expect(reconcileCorrect(ch([false, true, false, false, false]), "④").findIndex((c) => c.isCorrect)).toBe(1);
  });
  it("answer로도 정할 수 없으면 검증에서 걸린다", () => {
    expect(validateSingleAnswer(reconcileCorrect(ch([false, false, false, false, false]), "")).ok).toBe(false);
  });
});

describe("validateSingleAnswer", () => {
  it("정답 0개·2개·선지 부족을 거른다", () => {
    expect(validateSingleAnswer(ch([false, false, false])).reason).toBe("정답 표시 없음");
    expect(validateSingleAnswer(ch([true, true, false])).reason).toBe("정답 2개");
    expect(validateSingleAnswer(ch([true])).ok).toBe(false);
    expect(validateSingleAnswer(ch([false, true, false])).ok).toBe(true);
  });
});
