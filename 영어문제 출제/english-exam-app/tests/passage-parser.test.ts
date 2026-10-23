import { describe, expect, it } from "vitest";
import { normalizeUnderlineTags, splitInlineUnderline } from "@/lib/passage-parser";

const segs = (t: string) => splitInlineUnderline(normalizeUnderlineTags(t));

describe("빈칸·밑줄 인식", () => {
  it("밑줄 3개 이상은 빈칸으로 남긴다(예전엔 ____ 를 지워 빈칸이 사라졌음)", () => {
    expect(segs("through _________. When")).toEqual([
      { text: "through ", underline: false },
      { text: "", underline: false, blank: true },
      { text: ". When", underline: false },
    ]);
  });
  it("<u>…</u> 는 밑줄 텍스트", () => {
    expect(segs("a <u>word</u> b")).toEqual([
      { text: "a ", underline: false },
      { text: "word", underline: true },
      { text: " b", underline: false },
    ]);
  });
  it("빈 <u></u> 는 지운다", () => {
    expect(normalizeUnderlineTags("a <u></u> b")).toBe("a  b");
  });
  it("요약문 ______(A)______ 는 빈칸·라벨·빈칸", () => {
    expect(splitInlineUnderline("be ______(A)______ x").map((s) => (s.blank ? "_" : s.text))).toEqual([
      "be ",
      "_",
      "(A)",
      "_",
      " x",
    ]);
  });
});
