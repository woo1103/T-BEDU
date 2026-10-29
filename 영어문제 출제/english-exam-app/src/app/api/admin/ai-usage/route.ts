import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { costUsd, summarize } from "@/lib/ai-cost";

export const dynamic = "force-dynamic";

// 관리자: 이번 달·지난달 AI 사용량과 어림 비용
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  // 한국 시간 기준 달의 시작
  const kst = new Date(Date.now() + 9 * 3600_000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1) - 9 * 3600_000);
  const thisStart = monthStart(y, m);
  const lastStart = monthStart(y, m - 1);

  const rows = await prisma.aiUsage.findMany({
    where: { createdAt: { gte: lastStart } },
    select: {
      kind: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      cacheWriteTokens: true,
      cacheReadTokens: true,
      createdAt: true,
    },
  });
  const thisRows = rows.filter((r) => r.createdAt >= thisStart);
  const lastRows = rows.filter((r) => r.createdAt < thisStart);

  // 이번 달 날짜별 합계(한국 날짜)
  const daily = new Map<string, number>();
  for (const r of thisRows) {
    const d = new Date(r.createdAt.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    daily.set(d, (daily.get(d) ?? 0) + costUsd(r));
  }

  // 이번 달 남은 날을 지금까지 하루 평균으로 채운 예상치
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const today = kst.getUTCDate();
  const thisMonth = summarize(thisRows);

  return Response.json({
    month: `${y}-${String(m + 1).padStart(2, "0")}`,
    thisMonth,
    lastMonth: summarize(lastRows),
    projectedUsd: (thisMonth.usd / today) * daysInMonth,
    daily: [...daily.entries()].sort().map(([date, usd]) => ({ date, usd })),
  });
}
