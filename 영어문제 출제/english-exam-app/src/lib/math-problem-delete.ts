// 수학 은행 문제 지우기(하나·여러 개 공통). 학습지에 쓰인 문제는 지우지 않는다:
// 학생 앱·인쇄 화면이 학습지 문항마다 은행 문제의 본문·그림을 가져다 쓰기 때문.
import { prisma } from "@/lib/db";

export interface KeptProblem {
  id: string;
  worksheets: string[]; // 이 문제를 쓰는 학습지 제목
}

export async function deleteMathProblems(ids: string[]): Promise<{ removed: number; kept: KeptProblem[] }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return { removed: 0, kept: [] };

  const used = await prisma.worksheetItem.findMany({
    where: { mathProblemId: { in: unique } },
    select: { mathProblemId: true, worksheet: { select: { title: true } } },
  });
  const usedBy = new Map<string, Set<string>>();
  for (const u of used) {
    const set = usedBy.get(u.mathProblemId!) ?? new Set<string>();
    set.add(u.worksheet.title);
    usedBy.set(u.mathProblemId!, set);
  }
  const kept = [...usedBy].map(([id, titles]) => ({ id, worksheets: [...titles] }));
  const targets = unique.filter((id) => !usedBy.has(id));
  if (targets.length === 0) return { removed: 0, kept };

  const rows = await prisma.mathProblem.findMany({
    where: { id: { in: targets } },
    select: { id: true, cropImageId: true, figureImageId: true },
  });
  const imageIds = rows.flatMap((r) => [r.cropImageId, r.figureImageId]).filter((x): x is string => !!x);
  // 문제와 그 문제의 잘라낸 그림을 함께 지운다
  const [res] = await prisma.$transaction([
    prisma.mathProblem.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
    prisma.mathImage.deleteMany({ where: { id: { in: imageIds } } }),
  ]);
  return { removed: res.count, kept };
}
