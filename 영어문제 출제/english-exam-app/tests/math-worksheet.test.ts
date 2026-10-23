import { describe, expect, it } from "vitest";
import { answerFromStoredValue, detectChoicesCount, normalizeAnswer, stripFigurePlaceholder } from "@/lib/math-worksheet";
import { parseBox } from "@/lib/claude";

describe("객관식 판별·선생님 입력 정답 통일", () => {
  const mc = "함수 $f(x)$의 최댓값은? ① 1 ② 2 ③ 3 ④ 4 ⑤ 5";
  it("①~⑤가 다 있으면 5지선다", () => {
    expect(detectChoicesCount(mc)).toBe(5);
    expect(detectChoicesCount("값을 구하시오.")).toBeNull();
  });
  it.each([
    ["3", "③"],
    ["3번", "③"],
    ["(3)", "③"],
    ["③", "③"],
    ["정답 ④", "④"],
  ])("객관식 %s → %s", (a, b) => {
    expect(normalizeAnswer(a, 5)).toBe(b);
  });
  it("주관식은 그대로", () => {
    expect(normalizeAnswer(" 12 ", null)).toBe("12");
    expect(normalizeAnswer("3", null)).toBe("3");
  });
  it("객관식이어도 1~5 밖 숫자는 건드리지 않는다", () => {
    expect(normalizeAnswer("12", 5)).toBe("12");
  });
});

describe("정답 해석: 선생님 입력 vs 문제은행에 값으로 저장된 예전 정답", () => {
  const latex = "꼭짓점의 좌표를 (a,b)라 할 때 a+b의 값은?\n① $-1$ ② $0$ ③ $1$ ④ $2$ ⑤ $3$";
  it("선생님이 입력한 3은 ③ — ⑤ 선지 내용이 3이어도(실제로 헷갈렸던 경우)", () => {
    expect(normalizeAnswer("3", 5)).toBe("③");
  });
  it("저장된 값 1은 내용이 1인 ③으로(창을 열 때 미리 바꿔 보여 줌)", () => {
    expect(answerFromStoredValue("1", 5, latex)).toBe("③");
    expect(answerFromStoredValue("$-1$", 5, latex)).toBe("①");
  });
  it("표 문제처럼 선지가 값이면(76 → ③)", () => {
    expect(answerFromStoredValue("76", 5, "평균은?\n① $74$ ② $75$ ③ $76$ ④ $77$ ⑤ $78$")).toBe("③");
  });
  it("선지 내용과 안 맞으면 번호로 본다, 원문자는 그대로", () => {
    expect(answerFromStoredValue("4", 5, "옳은 것은?\n① ㄱ ② ㄴ ③ ㄷ ④ ㄱ,ㄴ ⑤ ㄴ,ㄷ")).toBe("④");
    expect(answerFromStoredValue("②", 5, latex)).toBe("②");
  });
});

describe("그림 자리 표시 지우기", () => {
  it("[그림] / [그림: 설명] 제거", () => {
    expect(stripFigurePlaceholder("다음 그래프에서\n[그림]\n넓이는?")).toBe("다음 그래프에서\n넓이는?");
    expect(stripFigurePlaceholder("[그림: 원과 접선] 길이는?")).toBe("길이는?");
  });
});

describe("parseBox (모델 좌표 0~1000 → 0~1)", () => {
  it("정상 좌표", () => {
    expect(parseBox([100, 200, 500, 600])).toEqual([0.1, 0.2, 0.5, 0.6]);
  });
  it("범위 밖은 잘라 맞춘다", () => {
    expect(parseBox([-50, 0, 1200, 400])).toEqual([0, 0, 1, 0.4]);
  });
  it("형식이 틀리거나 너무 작으면 버린다", () => {
    expect(parseBox([1, 2, 3])).toBeUndefined();
    expect(parseBox("10,20,30,40")).toBeUndefined();
    expect(parseBox([100, 100, 105, 400])).toBeUndefined();
  });
});
