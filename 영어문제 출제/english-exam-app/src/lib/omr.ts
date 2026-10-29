// 종이 답안 빠른 입력: 객관식 답을 숫자 한 줄로 받는다.
// "35241 14321" → ③⑤②④① ①④③②① (띄어쓰기는 무시, 0·-·. 는 안 고름)
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

export function parseOmrLine(line: string, count: number): string[] {
  const marks = [...line.replace(/\s+/g, "")].slice(0, count).map((ch) => {
    const n = Number(ch);
    return Number.isInteger(n) && n >= 1 && n <= 9 ? CIRCLED[n - 1] : "";
  });
  while (marks.length < count) marks.push("");
  return marks;
}

// 저장된 답(①·3 등) → 입력칸에 다시 보여 줄 숫자 한 줄(5개씩 띄어 쓴다)
export function toOmrLine(selected: string[]): string {
  const digits = selected.map((s) => {
    const i = CIRCLED.indexOf(s.trim());
    if (i >= 0) return String(i + 1);
    return /^[1-9]$/.test(s.trim()) ? s.trim() : "0";
  });
  return digits.map((d, i) => (i > 0 && i % 5 === 0 ? " " : "") + d).join("");
}

// 문항별 정답률 등 시험 통계
export interface ItemStat {
  label: string;
  correct: number;
  total: number;
  rate: number;
  // 가장 많이 고른 오답(객관식)
  topWrong: string | null;
}

export function itemStats(
  metas: { refId: string; label: string }[],
  submissions: { answers: { refId: string; selected: string; isCorrect: boolean }[] }[]
): ItemStat[] {
  return metas.map((m) => {
    let correct = 0;
    let total = 0;
    const wrong = new Map<string, number>();
    for (const s of submissions) {
      const a = s.answers.find((x) => x.refId === m.refId);
      if (!a) continue;
      total++;
      if (a.isCorrect) correct++;
      else if (a.selected) wrong.set(a.selected, (wrong.get(a.selected) ?? 0) + 1);
    }
    const top = [...wrong.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      label: m.label,
      correct,
      total,
      rate: total > 0 ? Math.round((correct / total) * 100) : 0,
      topWrong: top ? top[0] : null,
    };
  });
}
