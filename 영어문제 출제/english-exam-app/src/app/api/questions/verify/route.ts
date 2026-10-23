import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { WRITING_TYPES } from "@/lib/passage-parser";
import { verifyStoredQuestion } from "@/lib/verify";

// 기존 문항 독립 풀이 재검수.
// GET: 현황(객관식 수·통과·의심·오류·미검수, 미검수 중 시험지 배치)
// POST: { ids?: string[], scope?: "inExam" | "all" | "errors", batch?: number }
//   ids가 있으면 그 문항만(다시 검수), 없으면 미검수 문항을 batch개(최대 5) 골라 검수.
//   한 번에 몇 개씩만 처리하고 남은 수를 돌려준다 → 화면이 반복 호출하며 진행률 표시·중단 가능.
export const maxDuration = 60;

const objective = { questionType: { notIn: WRITING_TYPES } };
const inExam = { examItems: { some: {} } };

async function stats() {
  const [total, ok, suspect, error, unverified, unverifiedInExam] = await Promise.all([
    prisma.question.count({ where: objective }),
    prisma.question.count({ where: { ...objective, verifyStatus: "ok" } }),
    prisma.question.count({ where: { ...objective, verifyStatus: "suspect" } }),
    prisma.question.count({ where: { ...objective, verifyStatus: "error" } }),
    prisma.question.count({ where: { ...objective, verifyStatus: null } }),
    prisma.question.count({ where: { ...objective, verifyStatus: null, ...inExam } }),
  ]);
  return { total, ok, suspect, error, unverified, unverifiedInExam };
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  return NextResponse.json(await stats());
}

export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 미설정" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    scope?: "inExam" | "all" | "errors";
    batch?: number;
  };
  const batch = Math.min(5, Math.max(1, Number(body.batch) || 4));
  const select = { id: true, passage: true, question: true, choices: true } as const;

  const targets = Array.isArray(body.ids)
    ? await prisma.question.findMany({ where: { ...objective, id: { in: body.ids.slice(0, 5) } }, select })
    : await prisma.question.findMany({
        // errors: 검수 호출이 실패했던 문항 다시 시도
        where:
          body.scope === "errors"
            ? { ...objective, verifyStatus: "error" }
            : { ...objective, verifyStatus: null, ...(body.scope === "inExam" ? inExam : {}) },
        orderBy: { createdAt: "asc" },
        take: batch,
        select,
      });

  const results = await Promise.all(
    targets.map(async (q) => {
      const r = await verifyStoredQuestion(q);
      await prisma.question.update({
        where: { id: q.id },
        data: { verifyStatus: r.status, verifyNote: r.note || null, verifiedAt: new Date() },
      });
      return { id: q.id, ...r };
    })
  );

  return NextResponse.json({ results, stats: await stats() });
}
