// 묶음 3(학생·학부모): 오늘 할 일, 비슷한 문제 고르기, 월간 리포트 계산·CSV·PDF
import { describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/generate-core", () => ({ generateVerifiedQuestion: vi.fn() }));

import { monthOf, monthRange, monthlyRates, reportsToCsv, shiftMonth, type MonthlyReport } from "@/lib/report-format";
import { kstDayStart, pickUnseen } from "@/lib/practice";
import ParentReportPDF from "@/components/pdf/ParentReportPDF";
import { buildToday } from "../../student-app/src/lib/today";
import { countPdfPages } from "./fixtures";

describe("오늘 할 일", () => {
  const now = new Date("2026-10-30T03:00:00Z").getTime();
  const asg = (id: string, dueAt: string | null, done = false) => ({
    id,
    title: id,
    dueAt,
    subject: "english",
    className: "고2 A",
    submission: done ? { id: "s", status: "graded", score: 1, totalPoints: 1, submittedAt: "x" } : null,
  });
  it("낸 과제는 빼고, 마감 지난 것 → 가까운 것 → 마감 없는 것 순", () => {
    const items = buildToday(
      [asg("없음", null), asg("다음주", "2026-11-05T00:00:00Z"), asg("어제", "2026-10-29T00:00:00Z"), asg("냄", "2026-10-31T00:00:00Z", true)],
      [],
      0,
      now
    );
    expect(items.map((i) => i.id)).toEqual(["어제", "다음주", "없음"]);
    expect(items[0]).toMatchObject({ overdue: true });
  });
  it("안 본 영상과 복습할 오답이 뒤에 붙는다", () => {
    const v = (id: string, completed: boolean, percent = 0) => ({
      id, title: id, subject: "english", description: null, url: "", provider: "url",
      progress: completed || percent ? { positionSec: 0, percent, completed } : null,
    });
    const items = buildToday([], [v("본것", true, 100), v("반쯤", false, 40), v("안봄", false)], 3, now);
    expect(items.map((i) => i.kind + ":" + i.id)).toEqual(["video:반쯤", "video:안봄", "wrong:wrong"]);
    expect(items[0].sub).toContain("40%");
    expect(items[2].title).toContain("3개");
  });
});

describe("비슷한 문제 고르기", () => {
  it("이미 본 문제는 빼고 고른다", () => {
    const c = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(pickUnseen(c, new Set(["a", "c"]))?.id).toBe("b");
    expect(pickUnseen(c, new Set(["a", "b", "c"]))).toBeNull();
  });
  it("하루 한도는 한국 시간 0시 기준", () => {
    // 한국 10/30 08:59 = UTC 10/29 23:59 → 한국 10/30 0시 = UTC 10/29 15:00
    expect(kstDayStart(new Date("2026-10-29T23:59:00Z")).toISOString()).toBe("2026-10-29T15:00:00.000Z");
  });
});

describe("월간 리포트 계산", () => {
  it("한국 시간 달 경계", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T15:00:00.000Z");
    expect(monthOf(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11"); // 한국 11/1 01시
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 2)).toBe("2027-01");
  });
  it("최근 n달 정답률(답 없으면 null)", () => {
    const a = (iso: string, ok: boolean) => ({ isCorrect: ok, submittedAt: new Date(iso) });
    const r = monthlyRates([a("2026-10-03T00:00:00Z", true), a("2026-10-05T00:00:00Z", false), a("2026-08-10T00:00:00Z", true)], "2026-10", 3);
    expect(r).toEqual([
      { month: "2026-08", rate: 100, total: 1 },
      { month: "2026-09", rate: null, total: 0 },
      { month: "2026-10", rate: 50, total: 2 },
    ]);
  });
});

const REPORT: MonthlyReport = {
  month: "2026-10",
  student: { id: "s1", name: "김하늘", grade: "고2", classes: ["고2 심화 A"] },
  assignments: {
    assigned: 3,
    submitted: 2,
    rate: 67,
    list: [
      { title: "10월 1주 모의고사", dueAt: "2026-10-07T00:00:00Z", submitted: true, score: 82, totalPoints: 100 },
      { title: "어법 집중, \"수일치\"", dueAt: null, submitted: true, score: 18, totalPoints: 20 },
      { title: "빈칸 추론", dueAt: "2026-10-28T00:00:00Z", submitted: false, score: null, totalPoints: null },
    ],
  },
  accuracy: { rate: 74, correct: 74, total: 100, prevRate: 68 },
  trend: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m, i) => ({ month: m, rate: i === 1 ? null : 60 + i * 3, total: 10 })),
  areas: [
    { name: "빈칸 추론", correct: 5, total: 12, rate: 42 },
    { name: "어법", correct: 14, total: 18, rate: 78 },
    { name: "대의 파악", correct: 19, total: 21, rate: 90 },
  ],
  weak: [{ name: "빈칸 추론", correct: 5, total: 12, rate: 42 }],
  strong: [{ name: "대의 파악", correct: 19, total: 21, rate: 90 }],
  videos: { assigned: 6, completed: 4, watchedThisMonth: 5 },
  wrongNotes: { created: 26, resolved: 15, practiced: 9, practiceCorrect: 7 },
  comments: ["빈칸 추론에서 근거 문장을 먼저 찾는 연습을 하고 있어요."],
};

describe("월간 리포트 내보내기", () => {
  it("CSV: 엑셀용 BOM, 쉼표·따옴표 칸은 따옴표로 감싼다", () => {
    const csv = reportsToCsv([REPORT]);
    expect(csv.startsWith("﻿이름,학년,반,월")).toBe(true);
    const row = csv.split("\r\n")[1];
    expect(row).toContain("김하늘,고2,고2 심화 A,2026-10,3,2,67,74,68");
    expect(row).toContain("빈칸 추론 42%");
    expect(row).toContain("4/6");
    expect(row).toContain("7/9");
  });

  it("PDF: 학생마다 한 장", async () => {
    const two = [REPORT, { ...REPORT, student: { ...REPORT.student, id: "s2", name: "이바다" } }];
    expect(countPdfPages(await renderToBuffer(<ParentReportPDF reports={two} />))).toBe(2);
  });
});
