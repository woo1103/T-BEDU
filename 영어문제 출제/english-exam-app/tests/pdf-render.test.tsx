// 실제 PDF를 렌더링해 "계획한 쪽 수 = 실제 쪽 수"를 확인한다.
// 문항이 단 밖으로 넘치면 react-pdf가 쪽을 더 만들므로, 쪽 수 불일치 = 레이아웃 넘침.
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import ExamPDF, { planExamPages } from "@/components/pdf/ExamPDF";
import MockExamPDF, { planMockPages, type MockExamOptions } from "@/components/pdf/MockExamPDF";
import { countPdfPages, makeItems, pdfPageSizes } from "./fixtures";

const MOCK_OPTIONS: MockExamOptions = {
  examName: "2026학년도 10월 고1 모의고사 문제지",
  period: "제 3 교시",
  subject: "영어 영역",
  grade: "고1",
  includeListening: true,
};

describe("Daily Gift 양식 — 넘침 없음", () => {
  it.each([7, 42, 99])("시드 %i, 40문항", async (seed) => {
    const items = makeItems(seed, 40);
    const planned = planExamPages(items, "student").length;
    const buf = await renderToBuffer(<ExamPDF title="test" items={items} mode="student" />);
    expect(countPdfPages(buf)).toBe(planned + 2); // 표지 + 정답표
  });

  it.each([7, 42])("해설지 모드, 시드 %i", async (seed) => {
    const items = makeItems(seed, 40);
    const planned = planExamPages(items, "teacher").length;
    const buf = await renderToBuffer(<ExamPDF title="test" items={items} mode="teacher" />);
    expect(countPdfPages(buf)).toBe(planned + 2);
  });
});

describe("모의고사 양식 — 넘침 없음", () => {
  it.each([3, 7, 42, 99, 123, 256, 512, 777])("시드 %i, 28문항", async (seed) => {
    const items = makeItems(seed, 28, 10);
    const planned = planMockPages(items, MOCK_OPTIONS).length;
    const buf = await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="student" revealOverflow />);
    expect(countPdfPages(buf)).toBe(planned);
  });

  it.each([5, 42, 99])("해설지(굵은 정답 표시)도 넘침 없음 + 정답표 한 쪽, 시드 %i", async (seed) => {
    const items = makeItems(seed, 28, 10);
    const planned = planMockPages(items, MOCK_OPTIONS).length;
    const buf = await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="teacher" revealOverflow />);
    expect(countPdfPages(buf)).toBe(planned + 1);
  });
});

describe("해설지에 해설", () => {
  const LONG = "지문의 마지막 문장에서 필자는 협력의 중요성을 강조한다. ".repeat(6);
  const withExplain = (seed: number, n: number, max?: number) =>
    makeItems(seed, n, max).map((it) => ({ ...it, question: { ...it.question, explanation: LONG } }));

  it("Daily Gift: 해설지는 해설만큼 쪽이 늘고, 학생용은 그대로", async () => {
    const items = withExplain(42, 30);
    const planned = planExamPages(items, "teacher").length;
    const teacher = countPdfPages(await renderToBuffer(<ExamPDF title="t" items={items} mode="teacher" />));
    const student = countPdfPages(await renderToBuffer(<ExamPDF title="t" items={items} mode="student" />));
    expect(teacher).toBeGreaterThan(planned + 2);
    expect(student).toBe(planExamPages(items, "student").length + 2);
  });

  it("모의고사: 해설지 끝에 해설 쪽이 붙고 문제 쪽은 그대로", async () => {
    const items = withExplain(7, 28, 10);
    const planned = planMockPages(items, MOCK_OPTIONS).length;
    const teacher = countPdfPages(
      await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="teacher" revealOverflow />)
    );
    const student = countPdfPages(
      await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="student" revealOverflow />)
    );
    expect(teacher).toBeGreaterThan(planned + 1);
    expect(student).toBe(planned);
  });
});

describe("모의고사 양식 — 쪽은 항상 A4 세로", () => {
  const expectA4 = (buf: Buffer) => {
    const sizes = pdfPageSizes(buf);
    expect(sizes.length).toBeGreaterThan(0);
    for (const p of sizes) {
      expect(p.w).toBeCloseTo(595.28, 0);
      expect(p.h).toBeCloseTo(841.89, 0);
    }
  };

  it.each([1, 2, 5, 28])("%i문항(내용이 적은 쪽 포함)", async (n) => {
    const items = makeItems(11, n, 6);
    expectA4(await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="student" />));
    expectA4(await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="teacher" />));
  });

  it("계획한 쪽 수 그대로(넘침으로 빈 쪽이 생기지 않음)", async () => {
    const items = makeItems(42, 28, 10);
    const buf = await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="student" />);
    expect(countPdfPages(buf)).toBe(planMockPages(items, MOCK_OPTIONS).length);
  });

  it("긴 문항도 쪽 전체 폭으로 나가지 않고 두 단에 이어진다", async () => {
    const base = makeItems(5, 3, 6);
    const long = "Research suggests that students remember information better when they explain it to others in their own words. ".repeat(19);
    const longChoice = "students remember information better when they explain it to others in their own words and practise it regularly";
    const items = base.map((it, i) => ({
      ...it,
      question: {
        ...it.question,
        questionType: "naesin_topic",
        passage: i === 1 ? long : "Short passage.",
        choices: JSON.stringify(["①", "②", "③", "④", "⑤"].map((label, k) => ({ label, text: longChoice, isCorrect: k === 0 }))),
      },
    }));
    const pages = planMockPages(items, MOCK_OPTIONS);
    expect(pages.every((p) => p.kind === "columns")).toBe(true);
    const buf = await renderToBuffer(<MockExamPDF items={items} options={MOCK_OPTIONS} mode="student" revealOverflow />);
    expect(countPdfPages(buf)).toBe(pages.length);
  });
});
