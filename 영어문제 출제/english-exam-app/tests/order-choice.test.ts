import { describe, expect, it } from "vitest";
import { orderChoiceText } from "@/lib/question-validate";
import { getSystemPrompt } from "@/lib/prompts";

describe("순서 배열 선지는 순서만", () => {
  it("순서 뒤 설명 문장을 잘라 낸다", () => {
    expect(orderChoiceText("(B) — (C) — (A): The passage first elaborates the environmental toll")).toBe("(B) - (C) - (A)");
    expect(orderChoiceText("(A)-(C)-(B)")).toBe("(A) - (C) - (B)");
    expect(orderChoiceText("(D) - (C) - (B)")).toBe("(D) - (C) - (B)");
  });
  it("순서가 아니면 그대로 둔다", () => {
    expect(orderChoiceText("①")).toBe("①");
  });
});

describe("소재 변형은 원문 그대로 출제보다 앞선다", () => {
  it("topic_narrow를 고르면 변형 활용 지시가 붙는다", () => {
    const p = getSystemPrompt("naesin", "naesin_order", "medium", "Some passage.", "original", undefined, ["topic_narrow"])!;
    expect(p).toContain("변형 활용");
    expect(p).not.toContain("원문 그대로 활용");
    expect(p).toContain("소재 일부만 남기기");
  });
  it("topic_replace_one도 지문을 다시 쓴다", () => {
    const p = getSystemPrompt("naesin", "naesin_order", "medium", "Some passage.", "original", undefined, ["topic_replace_one"])!;
    expect(p).toContain("변형 활용");
    expect(p).toContain("소재 하나만 바꾸기");
  });
  it("소재 변형이 없으면 원문 그대로", () => {
    const p = getSystemPrompt("naesin", "naesin_order", "medium", "Some passage.", "original")!;
    expect(p).toContain("원문 그대로 활용");
  });
});

import { composeSource } from "@/lib/question-source";
describe("문제 출처 한 줄", () => {
  it("수능·모의평가·사설", () => {
    expect(composeSource({ kind: "suneung", year: "2025", number: "31" })).toBe("2025 수능 31번");
    expect(composeSource({ kind: "kice", year: "2024", month: "9", grade: "고3", number: "33번" })).toBe("2024 고3 9월 평가원 모의평가 33번");
    expect(composeSource({ kind: "private", memo: "이감 모의고사 3회", number: "21" })).toBe("이감 모의고사 3회 21번");
    expect(composeSource({ kind: "" })).toBe("");
  });
});
