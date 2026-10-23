import { describe, expect, it } from "vitest";
import { countLines, packColumns, textWidth, SERIF_METRICS } from "@/lib/pdf-layout";

describe("textWidth / countLines", () => {
  it("한 줄에 들어가면 1줄, 폭을 넘으면 줄이 늘어난다", () => {
    const w = textWidth("hello world", 10);
    expect(countLines("hello world", 10, w + 1)).toBe(1);
    expect(countLines("hello world", 10, w - 1)).toBe(2);
  });
  it("줄바꿈 문자는 문단을 나눈다", () => {
    expect(countLines("a\nb\nc", 10, 500)).toBe(3);
  });
  it("명조는 고딕과 다른 폭을 쓴다", () => {
    expect(textWidth("Wonderful", 10, false, SERIF_METRICS)).not.toBe(textWidth("Wonderful", 10));
  });
});

describe("packColumns", () => {
  const pack = (heights: number[], columnHeight: number | ((p: number) => number) = 100) =>
    packColumns(heights, (h) => h, { columnsPerPage: 2, columnHeight, gap: 10 });

  it("한 단에 들어가는 문항은 순서대로 단을 채운다", () => {
    const pages = pack([40, 40, 40, 40]);
    expect(pages).toEqual([{ kind: "columns", columns: [[40, 40], [40, 40]] }]);
  });
  it("한 단을 넘는 문항만 단독 페이지", () => {
    const pages = pack([40, 150, 40]);
    expect(pages.map((p) => p.kind)).toEqual(["columns", "oversize", "columns"]);
  });
  it("쪽마다 단 높이를 다르게 줄 수 있다(첫 쪽은 머리가 커서 덜 들어감)", () => {
    const pages = pack([120, 120, 120, 120, 120, 120], (p) => (p === 0 ? 130 : 300));
    expect(pages).toEqual([
      { kind: "columns", columns: [[120], [120]] },
      { kind: "columns", columns: [[120, 120], [120, 120]] },
    ]);
  });
});
