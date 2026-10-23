// 실제 PDF를 렌더링해 "계획한 쪽 수 = 실제 쪽 수"를 확인한다.
// 문항이 단 밖으로 넘치면 react-pdf가 쪽을 더 만들므로, 쪽 수 불일치 = 레이아웃 넘침.
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import ExamPDF, { planExamPages } from "@/components/pdf/ExamPDF";
import MockExamPDF, { planMockPages, type MockExamOptions } from "@/components/pdf/MockExamPDF";
import { countPdfPages, makeItems } from "./fixtures";

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
