import { describe, expect, it } from "vitest";
import { parseVocabText, partsOf, rowsToVocab, seededShuffle, splitIntoParts } from "@/lib/vocab";

describe("엑셀 행 → 단어 (범위 열 알아보기)", () => {
  it("범위 머리글 + 1,1,2", () => {
    const r = rowsToVocab([["범위", "단어", "뜻"], [1, "abandon", "버리다"], [1, "benefit", "이익"], [2, "consider", "고려하다"]]);
    expect(r.map((w) => [w.part, w.word])).toEqual([[1, "abandon"], [1, "benefit"], [2, "consider"]]);
  });
  it("머리글 없이 되풀이되는 숫자는 범위", () => {
    const r = rowsToVocab([[1, "a", "가"], [1, "b", "나"], [2, "c", "다"]]);
    expect(partsOf(r)).toEqual([{ part: 1, count: 2 }, { part: 2, count: 1 }]);
  });
  it("Day 3 형식도 범위", () => {
    const r = rowsToVocab([["Day 3", "a", "가"], ["Day 4", "b", "나"]]);
    expect(r.map((w) => w.part)).toEqual([3, 4]);
  });
  it("1,2,3 늘어나는 번호 열은 버리고 범위 없음", () => {
    const r = rowsToVocab([["번호", "단어", "뜻"], [1, "a", "가"], [2, "b", "나"], [3, "c", "다"]]);
    expect(r.map((w) => [w.part, w.word])).toEqual([[undefined, "a"], [undefined, "b"], [undefined, "c"]]);
  });
  it("범위 열 없이 단어·뜻·예문", () => {
    const r = rowsToVocab([["단어", "뜻", "예문"], ["abandon", "버리다", "He abandoned it."]]);
    expect(r).toEqual([{ word: "abandon", meaning: "버리다", example: "He abandoned it." }]);
  });
  it("붙여 넣기와 n단어씩 나누기", () => {
    const r = splitIntoParts(parseVocabText("a, 가\nb - 나\nc: 다\nd\t라\ne = 마"), 2);
    expect(r.map((w) => w.part)).toEqual([1, 1, 2, 2, 3]);
  });
  it("같은 시드면 같은 순서", () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 7)).toEqual(seededShuffle([1, 2, 3, 4, 5], 7));
  });
});
