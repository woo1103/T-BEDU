// 도표(25번) 그래프 좌표 계산 — 화면(SVG)·PDF가 같은 계산으로 그린다.
// 학생 앱(student-app/src/lib/chart-layout.ts)에 같은 파일을 복사해 쓴다.
import { chartTicks, type ChartSpec } from "./passage-parser";

export interface ChartLayout {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  yTicks: { value: number; y: number; label: string }[];
  categories: { label: string; x: number }[];
  bars: { x: number; y: number; w: number; h: number; series: number; value: number }[];
  lines: { series: number; points: { x: number; y: number; value: number }[] }[];
  legend: { name: string; series: number }[];
}

// 계열 색(흑백 인쇄에서도 구분되도록 명도 차이를 크게)
export const SERIES_FILL = ["#2F4858", "#9AA7B0", "#D9DEE2"];

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function layoutChart(chart: ChartSpec, width = 520, height = 300): ChartLayout {
  const max = Math.max(...chart.series.flatMap((s) => s.values), 0);
  const ticks = chartTicks(max);
  const top = 28;
  const plot = { left: 44, top, right: width - 12, bottom: height - 46 };
  const yMax = ticks[ticks.length - 1] || 1;
  const yOf = (v: number) => plot.bottom - ((plot.bottom - plot.top) * v) / yMax;

  const n = chart.categories.length;
  const slot = (plot.right - plot.left) / n;
  const categories = chart.categories.map((label, i) => ({ label, x: plot.left + slot * (i + 0.5) }));

  const bars: ChartLayout["bars"] = [];
  const lines: ChartLayout["lines"] = [];
  if (chart.type === "bar") {
    const groupW = slot * 0.72;
    const barW = groupW / chart.series.length;
    chart.series.forEach((s, si) => {
      s.values.forEach((v, ci) => {
        const x = plot.left + slot * ci + (slot - groupW) / 2 + barW * si;
        const y = yOf(v);
        bars.push({ x, y, w: Math.max(barW - 2, 1), h: plot.bottom - y, series: si, value: v });
      });
    });
  } else {
    chart.series.forEach((s, si) => {
      lines.push({ series: si, points: s.values.map((v, ci) => ({ x: categories[ci].x, y: yOf(v), value: v })) });
    });
  }

  return {
    width,
    height,
    plot,
    yTicks: ticks.map((v) => ({ value: v, y: yOf(v), label: fmt(v) })),
    categories,
    bars,
    lines,
    legend: chart.series.map((s, i) => ({ name: s.name, series: i })),
  };
}

export const formatChartValue = fmt;

// 긴 항목 이름은 두 줄로
export function wrapLabel(label: string, max = 14): string[] {
  if (label.length <= max) return [label];
  const words = label.split(" ");
  let first = "";
  while (words.length && (first + " " + words[0]).trim().length <= max) first = (first + " " + words.shift()).trim();
  if (!first) first = words.shift() ?? "";
  return [first, words.join(" ")].filter(Boolean);
}

