import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { ENGLISH_AREAS, areaForQuestionType } from "@/lib/english-areas";

// 영어 문항에 questionType 기준 능력영역 태그를 자동 배정 (이미 있으면 건너뜀).
export async function POST() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  // 능력영역 태그가 없으면 시드
  const existingCount = await prisma.tag.count({
    where: { subject: "english", kind: "영역" },
  });
  if (existingCount === 0) {
    for (const name of ENGLISH_AREAS) {
      await prisma.tag
        .create({ data: { subject: "english", kind: "영역", name } })
        .catch(() => {});
    }
  }

  const areaTags = await prisma.tag.findMany({
    where: { subject: "english", kind: "영역" },
  });
  const tagIdByArea = new Map(areaTags.map((t) => [t.name, t.id]));

  const questions = await prisma.question.findMany({
    where: { examType: { in: ["suneung", "naesin"] } },
    select: {
      id: true,
      questionType: true,
      questionTags: { select: { tagId: true } },
    },
  });

  let assigned = 0;
  let skipped = 0;
  for (const q of questions) {
    const area = areaForQuestionType(q.questionType);
    if (!area) {
      skipped++;
      continue;
    }
    const tagId = tagIdByArea.get(area);
    if (!tagId) {
      skipped++;
      continue;
    }
    if (q.questionTags.some((qt) => qt.tagId === tagId)) {
      skipped++;
      continue;
    }
    await prisma.questionTag
      .create({ data: { questionId: q.id, tagId } })
      .catch(() => {});
    assigned++;
  }

  return NextResponse.json({ assigned, skipped, total: questions.length });
}
