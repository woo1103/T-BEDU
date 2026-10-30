// 25번 도표·장문 세트(41~45번): 데이터 해석, 구조 검사, 묶기, 실제 PDF 배치
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { chartProblem, chartTicks, splitChart } from "@/lib/passage-parser";
import { validateQuestionStructure } from "@/lib/question-validate";
import { groupSetRuns, withSetMembers } from "@/lib/question-sets";
import { layoutChart } from "@/lib/chart-layout";
import ExamPDF, { planExamPages, type ExamItemData } from "@/components/pdf/ExamPDF";
import MockExamPDF, { planMockPages, type MockExamOptions } from "@/components/pdf/MockExamPDF";
import { countPdfPages, makeItems } from "./fixtures";

const CHART = {
  title: "Share of Students Using Each Study Method",
  unit: "%",
  type: "bar" as const,
  categories: ["Online videos", "Textbooks", "Group study", "Tutoring"],
  series: [
    { name: "2019", values: [34, 28, 19, 11] },
    { name: "2023", values: [45, 22, 17, 13] },
  ],
};
const CHART_PASSAGE =
  `<chart>${JSON.stringify(CHART)}</chart>\nThe above graph shows the share of students using each study method in 2019 and 2023. ` +
  "① Online videos were the most popular method in both years. ② The share of textbooks decreased by 6 percentage points. " +
  "③ Group study was less popular than tutoring in 2023. ④ Tutoring increased from 2019 to 2023. ⑤ In 2023, online videos were used by 45 percent.";
const MARKERS = ["①", "②", "③", "④", "⑤"].map((l, i) => ({ label: l, text: l, isCorrect: i === 2 }));

describe("도표 데이터", () => {
  it("지문 앞 <chart>를 떼어 내고 나머지 글만 남긴다", () => {
    const { chart, text } = splitChart(CHART_PASSAGE);
    expect(chart?.categories).toHaveLength(4);
    expect(text.startsWith("The above graph")).toBe(true);
  });

  it("깨진 데이터는 그래프 없이 글만", () => {
    const { chart, text } = splitChart('<chart>{"title":"x"</chart>Hello');
    expect(chart).toBeNull();
    expect(text).toBe("Hello");
  });

  it("값 개수·종류 오류를 알려 준다", () => {
    expect(chartProblem(CHART)).toBeNull();
    expect(chartProblem({ ...CHART, type: "pie" })).toMatch(/종류/);
    expect(chartProblem({ ...CHART, series: [{ name: "a", values: [1, 2] }] })).toMatch(/개수/);
    expect(chartProblem({ ...CHART, categories: ["a", "b"], series: [{ name: "a", values: [1, 2] }] })).toMatch(/3~8/);
  });

  it("눈금은 최댓값을 덮는 깔끔한 간격", () => {
    expect(chartTicks(45)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(chartTicks(7.4).at(-1)).toBeGreaterThanOrEqual(7.4);
  });

  it("막대는 계열 수 × 항목 수, 꺾은선은 계열마다 한 줄", () => {
    expect(layoutChart(CHART).bars).toHaveLength(8);
    const line = layoutChart({ ...CHART, type: "line" });
    expect(line.lines).toHaveLength(2);
    expect(line.lines[0].points).toHaveLength(4);
  });
});

describe("구조 검사", () => {
  it("25번: 도표 데이터와 ①~⑤ 문장이 있어야", () => {
    expect(validateQuestionStructure("25_chart", CHART_PASSAGE, MARKERS).ok).toBe(true);
    expect(validateQuestionStructure("25_chart", CHART_PASSAGE.replace(/<chart>.*<\/chart>/, ""), MARKERS).reason).toMatch(/도표/);
    expect(validateQuestionStructure("25_chart", CHART_PASSAGE.replace("④", ""), MARKERS).reason).toMatch(/④/);
  });

  it("42·44번: (a)~(e) 표시가 모두 있어야", () => {
    const letters = ["(a)", "(b)", "(c)", "(d)", "(e)"].map((t, i) => ({ label: "①②③④⑤"[i], text: t, isCorrect: i === 0 }));
    const p = "x (a) <u>one</u> (b) <u>two</u> (c) <u>three</u> (d) <u>four</u> (e) <u>five</u>";
    expect(validateQuestionStructure("42_long_vocab", p, letters).ok).toBe(true);
    expect(validateQuestionStructure("44_long_refer", p.replace("(d)", ""), letters).ok).toBe(false);
  });
});

const q = (questionType: string, passage: string, setId: string | null) => ({ question: { questionType, passage, setId } });

describe("장문 세트 묶기", () => {
  it("같은 setId가 이어지면 한 묶음", () => {
    const runs = groupSetRuns([
      q("22_gist", "a", null),
      q("41_long_title", "P", "s1"),
      q("42_long_vocab", "P", "s1"),
      q("43_long_order", "Q", "s2"),
      q("44_long_refer", "Q", "s2"),
      q("45_long_content", "Q", "s2"),
    ]);
    expect(runs.map((r) => [r.set, r.items.length])).toEqual([
      [false, 1],
      [true, 2],
      [true, 3],
    ]);
  });

  it("setId 없는 예전 데이터도 세트 유형 + 같은 지문이면 묶는다(일반 문항은 안 묶음)", () => {
    const runs = groupSetRuns([q("41_long_title", "P", null), q("42_long_vocab", "P", null), q("22_gist", "P", null)]);
    expect(runs.map((r) => r.items.length)).toEqual([2, 1]);
  });

  it("세트 문항 하나를 고르면 세트 전체가 번호 순으로", () => {
    const bank = [
      { id: "x", questionType: "22_gist", setId: null },
      { id: "c", questionType: "45_long_content", setId: "s" },
      { id: "a", questionType: "43_long_order", setId: "s" },
      { id: "b", questionType: "44_long_refer", setId: "s" },
    ];
    expect(withSetMembers([bank[3], bank[0]], bank).map((x) => x.id)).toEqual(["a", "b", "c", "x"]);
  });
});

// 실제 PDF: 세트·도표가 들어간 시험지도 계획한 쪽 수 그대로(넘침 없음)
function withSetsAndChart(seed: number, n: number, max?: number): ExamItemData[] {
  const base = makeItems(seed, n, max);
  const long = Array.from({ length: 4 }, (_, k) => `(${"ABCD"[k]})\n` + base[k].question.passage.slice(0, 500)).join("\n\n");
  const member = (orderNum: number, questionType: string, passage: string, setId: string) => ({
    orderNum,
    customPoints: null,
    question: { ...base[0].question, questionType, passage, setId, question: "윗글의 제목으로 가장 적절한 것은?" },
  });
  const items: ExamItemData[] = [
    { ...base[0], orderNum: 1, question: { ...base[0].question, questionType: "25_chart", passage: CHART_PASSAGE, choices: JSON.stringify(MARKERS) } },
    ...base.slice(1).map((it, i) => ({ ...it, orderNum: i + 2 })),
  ];
  const k = items.length;
  items.push(member(k + 1, "41_long_title", long.slice(0, 1400), "s1"), member(k + 2, "42_long_vocab", long.slice(0, 1400), "s1"));
  items.push(
    member(k + 3, "43_long_order", long, "s2"),
    member(k + 4, "44_long_refer", long, "s2"),
    member(k + 5, "45_long_content", long, "s2")
  );
  return items;
}

const MOCK: MockExamOptions = {
  examName: "세트 확인",
  period: "제 3 교시",
  subject: "영어 영역",
  grade: "고1",
  includeListening: true,
};

describe("도표·세트가 들어간 PDF — 넘침 없음", () => {
  it.each([7, 42])("Daily Gift, 시드 %i", async (seed) => {
    const items = withSetsAndChart(seed, 14);
    const planned = planExamPages(items, "student").length;
    const buf = await renderToBuffer(<ExamPDF title="t" items={items} mode="student" />);
    expect(countPdfPages(buf)).toBe(planned + 2);
  });

  it.each([7, 42])("모의고사, 시드 %i", async (seed) => {
    const items = withSetsAndChart(seed, 14, 8);
    const planned = planMockPages(items, MOCK).length;
    const buf = await renderToBuffer(<MockExamPDF items={items} options={MOCK} mode="student" revealOverflow />);
    expect(countPdfPages(buf)).toBe(planned);
  });
});
