// 학부모 월간 리포트의 형식·계산(브라우저에서도 쓰는 부분 — DB 없음)
import type { AreaStat } from "@/lib/achievement";

const KST = 9 * 3600_000;

// "2026-10" → 그 달 한국 시간 1일 0시 ~ 다음 달 1일 0시
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1) - KST), end: new Date(Date.UTC(y, m, 1) - KST) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthOf(date: Date): string {
  const k = new Date(date.getTime() + KST);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonth(month: unknown): month is string {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

const rate = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : null);

// 월별 정답률(문항 기준) — 최근 n달, 답이 없으면 null
export function monthlyRates(
  answers: { isCorrect: boolean; submittedAt: Date }[],
  lastMonth: string,
  n: number
): { month: string; rate: number | null; total: number }[] {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(lastMonth, i - n + 1));
  const agg = new Map(months.map((m) => [m, { c: 0, t: 0 }]));
  for (const a of answers) {
    const cur = agg.get(monthOf(a.submittedAt));
    if (!cur) continue;
    cur.t++;
    if (a.isCorrect) cur.c++;
  }
  return months.map((m) => ({ month: m, rate: rate(agg.get(m)!.c, agg.get(m)!.t), total: agg.get(m)!.t }));
}

export interface MonthlyReport {
  month: string;
  student: { id: string; name: string; grade: string; classes: string[] };
  assignments: {
    assigned: number;
    submitted: number;
    rate: number | null;
    list: { title: string; dueAt: string | null; submitted: boolean; score: number | null; totalPoints: number | null }[];
  };
  accuracy: { rate: number | null; correct: number; total: number; prevRate: number | null };
  trend: { month: string; rate: number | null; total: number }[];
  areas: AreaStat[];
  weak: AreaStat[];
  strong: AreaStat[];
  videos: { assigned: number; completed: number; watchedThisMonth: number };
  wrongNotes: { created: number; resolved: number; practiced: number; practiceCorrect: number };
  comments: string[];
}

// 반 전체 CSV(엑셀에서 한글이 깨지지 않게 BOM)
export function reportsToCsv(reports: MonthlyReport[]): string {
  const head = [
    "이름", "학년", "반", "월", "과제 배정", "과제 제출", "제출률(%)", "정답률(%)", "지난달 정답률(%)",
    "약한 영역", "강한 영역", "영상 완료/배정", "새 오답", "복습 완료", "비슷한 문제 풀이(맞힘/전체)", "선생님 코멘트",
  ];
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = reports.map((r) => [
    r.student.name,
    r.student.grade,
    r.student.classes.join(" / "),
    r.month,
    r.assignments.assigned,
    r.assignments.submitted,
    r.assignments.rate ?? "",
    r.accuracy.rate ?? "",
    r.accuracy.prevRate ?? "",
    r.weak.map((a) => `${a.name} ${a.rate}%`).join(" · "),
    r.strong.map((a) => `${a.name} ${a.rate}%`).join(" · "),
    `${r.videos.completed}/${r.videos.assigned}`,
    r.wrongNotes.created,
    r.wrongNotes.resolved,
    `${r.wrongNotes.practiceCorrect}/${r.wrongNotes.practiced}`,
    r.comments.join(" / "),
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
