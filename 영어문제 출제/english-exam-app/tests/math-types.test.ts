import { describe, expect, it } from "vitest";
import { MATH_TYPES, findMathType, mathTypeLabel, typeCodeFilter } from "@/lib/math-types";

const all = MATH_TYPES.courses.flatMap((c) => c.units.flatMap((u) => u.types.map((t) => ({ c, u, t }))));

describe("수학 유형코드표", () => {
  it("PDF 3개의 과정·유형 수 그대로(초 12 · 중 6 · 고 7 과정, 3,062개 유형)", () => {
    const count = (lv: string) => MATH_TYPES.courses.filter((c) => c.level === lv).length;
    expect([count("초등부"), count("중등부"), count("고등부")]).toEqual([12, 6, 7]);
    expect(all.length).toBe(3062);
  });

  it("코드는 겹치지 않고 과정-단원-유형 순서를 따른다", () => {
    expect(new Set(all.map((x) => x.t.code)).size).toBe(all.length);
    for (const { c, u, t } of all) {
      expect(u.code).toBe(`${c.code}-${String(u.no).padStart(2, "0")}`);
      expect(t.code).toBe(`${u.code}-${String(t.no).padStart(2, "0")}`);
    }
  });

  it("단원 안 유형 번호는 1부터 빠짐없이, 이름·영역이 비지 않는다", () => {
    for (const c of MATH_TYPES.courses)
      for (const u of c.units) {
        expect(u.types.map((t) => t.no)).toEqual(u.types.map((_, i) => i + 1));
        for (const t of u.types) {
          expect(t.name.trim()).not.toBe("");
          expect(t.area.trim()).not.toBe("");
          expect(t.name).not.toMatch(/\t|\s{2}/);
        }
      }
  });

  it("코드로 찾기·이름 붙이기", () => {
    expect(mathTypeLabel("M1-1-01-07")).toBe("중1-1 · 1. 소인수분해 · 소인수분해하기 (가지치기, 나눗셈)");
    expect(findMathType("M1-1-01-99")).toBeNull();
    expect(findMathType("")).toBeNull();
  });

  it("거르기: 유형 코드는 그 유형만, 과정·단원 코드는 그 아래 전체(HC1이 HCA1을 잡지 않음)", () => {
    expect(typeCodeFilter("HC1-02-10")).toEqual({ equals: "HC1-02-10" });
    expect(typeCodeFilter("HC1-02")).toEqual({ startsWith: "HC1-02-" });
    expect(typeCodeFilter("HC1")).toEqual({ startsWith: "HC1-" });
    expect("HCA1-01-01".startsWith("HC1-")).toBe(false);
  });
});
