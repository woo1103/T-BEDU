import { prisma } from "@/lib/db";

export interface AreaStat {
  name: string;
  correct: number;
  total: number;
  rate: number; // 0~100
}

export interface Breakdown {
  overall: { correct: number; total: number; rate: number };
  areas: AreaStat[]; // 정답률 오름차순(취약 → 강점)
}

// questionId → 능력영역(kind="영역") 태그 이름 배열
export async function areaNamesByQuestion(
  questionIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (questionIds.length === 0) return map;
  const links = await prisma.questionTag.findMany({
    where: { questionId: { in: questionIds }, tag: { kind: "영역" } },
    select: { questionId: true, tag: { select: { name: true } } },
  });
  for (const l of links) {
    const arr = map.get(l.questionId) ?? [];
    arr.push(l.tag.name);
    map.set(l.questionId, arr);
  }
  return map;
}

// 답안 목록 + 영역맵 → 전체/영역별 정답률
export function computeBreakdown(
  answers: { refId: string; isCorrect: boolean }[],
  areaMap: Map<string, string[]>
): Breakdown {
  let overallCorrect = 0;
  let overallTotal = 0;
  const agg = new Map<string, { correct: number; total: number }>();

  for (const a of answers) {
    overallTotal++;
    if (a.isCorrect) overallCorrect++;
    for (const name of areaMap.get(a.refId) ?? []) {
      const cur = agg.get(name) ?? { correct: 0, total: 0 };
      cur.total++;
      if (a.isCorrect) cur.correct++;
      agg.set(name, cur);
    }
  }

  const areas: AreaStat[] = [...agg.entries()]
    .map(([name, v]) => ({
      name,
      correct: v.correct,
      total: v.total,
      rate: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate);

  return {
    overall: {
      correct: overallCorrect,
      total: overallTotal,
      rate: overallTotal ? Math.round((overallCorrect / overallTotal) * 100) : 0,
    },
    areas,
  };
}
