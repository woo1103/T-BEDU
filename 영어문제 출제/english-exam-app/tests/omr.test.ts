import { describe, expect, it } from "vitest";
import { itemStats, parseOmrLine, toOmrLine } from "@/lib/omr";

describe("종이 답 숫자 한 줄", () => {
  it("숫자 → 원문자, 띄어쓰기 무시, 0·-·. 은 안 고름, 모자라면 빈칸", () => {
    expect(parseOmrLine("352 0-.4", 8)).toEqual(["③", "⑤", "②", "", "", "", "④", ""]);
  });
  it("문항 수보다 길면 뒤를 버린다", () => {
    expect(parseOmrLine("123456", 3)).toEqual(["①", "②", "③"]);
  });
  it("저장된 답을 다시 숫자 한 줄로(5개씩 띄움), 되돌리면 같다", () => {
    const sel = ["③", "⑤", "", "1", "②", "④"];
    const line = toOmrLine(sel);
    expect(line).toBe("35012 4");
    expect(parseOmrLine(line, 6)).toEqual(["③", "⑤", "", "①", "②", "④"]);
  });
});

describe("문항 통계", () => {
  it("정답률과 가장 많이 고른 오답", () => {
    const metas = [{ refId: "a", label: "1번" }, { refId: "b", label: "2번" }];
    const subs = [
      { answers: [{ refId: "a", selected: "①", isCorrect: true }, { refId: "b", selected: "③", isCorrect: false }] },
      { answers: [{ refId: "a", selected: "②", isCorrect: false }, { refId: "b", selected: "③", isCorrect: false }] },
      { answers: [{ refId: "a", selected: "①", isCorrect: true }] },
    ];
    expect(itemStats(metas, subs)).toEqual([
      { label: "1번", correct: 2, total: 3, rate: 67, topWrong: "②" },
      { label: "2번", correct: 0, total: 2, rate: 0, topWrong: "③" },
    ]);
  });
});
