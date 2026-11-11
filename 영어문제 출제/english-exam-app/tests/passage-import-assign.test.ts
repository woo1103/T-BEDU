// 지문 PDF 가져오기(쪽 사이 이어 붙이기) · 과제에서 학생 빼기(대상 계산)
import { describe, expect, it } from "vitest";
import { addPage, joinParts, wordCount } from "@/lib/passage-import";
import { isTarget, parseTargetIds, targetsWithout } from "@/lib/assignment-targets";

describe("지문 가져오기", () => {
  it("문장 중간에서 끊긴 지문은 한 칸 띄워, 문장 끝이면 문단을 나눠 잇는다", () => {
    expect(joinParts("They walked to the", "station together.")).toBe("They walked to the station together.");
    expect(joinParts("It was late.", "Next morning, ...")).toBe("It was late.\n\nNext morning, ...");
    expect(joinParts('"Stop!"', "she said.")).toBe('"Stop!"\n\nshe said.');
    expect(joinParts("", "Only")).toBe("Only");
  });

  it("쪽 맨 위가 이어지는 글이면 앞 지문에 붙이고, 과가 안 보이면 앞 지문의 과를 쓴다", () => {
    let d = addPage([], 1, [{ lesson: "Lesson 2", title: "Bees", content: "Bees are important because they", continued: false }], "Lesson 1");
    d = addPage(
      d,
      2,
      [
        { content: "pollinate many crops.", continued: true },
        { title: "Ants", content: "Ants live in colonies.", continued: false },
      ],
      "Lesson 1"
    );
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ lesson: "Lesson 2", page: 1, content: "Bees are important because they pollinate many crops." });
    expect(d[1]).toMatchObject({ lesson: "Lesson 2", title: "Ants", page: 2, include: true });
  });

  it("첫 쪽부터 '이어짐'이면 새 지문으로, 과는 기본값", () => {
    const d = addPage([], 1, [{ content: "middle of a text.", continued: true }], "Lesson 5");
    expect(d).toHaveLength(1);
    expect(d[0].lesson).toBe("Lesson 5");
    expect(wordCount(" a b  c ")).toBe(3);
  });
});

describe("과제에서 학생 빼기", () => {
  it("대상 해석: 비었거나 깨졌으면 반 전체", () => {
    expect(parseTargetIds(null)).toBeNull();
    expect(parseTargetIds("[]")).toBeNull();
    expect(parseTargetIds("oops")).toBeNull();
    expect(parseTargetIds('["a","b"]')).toEqual(["a", "b"]);
    expect(isTarget(null, "x")).toBe(true);
    expect(isTarget('["a"]', "x")).toBe(false);
  });

  it("반 전체 과제는 지금 반 학생에서 그 학생만 뺀 지정 과제가 된다", () => {
    expect(targetsWithout(null, ["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("지정 과제는 그 학생만 빠지고, 마지막 한 명이면 빈 목록(과제 삭제)", () => {
    expect(targetsWithout('["a","b"]', ["a", "b", "c"], "a")).toEqual(["b"]);
    expect(targetsWithout('["a"]', ["a", "b"], "a")).toEqual([]);
  });
});
