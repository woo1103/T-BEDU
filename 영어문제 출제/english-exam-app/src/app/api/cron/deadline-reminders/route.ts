import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyStudentIds } from "@/lib/notify";

// 마감 임박(24시간 이내) 과제의 미제출자에게 자동 리마인드.
// Vercel Cron이 호출. CRON_SECRET로 보호(미설정 시 비활성).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET 미설정으로 비활성화됨" },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const assignments = await prisma.assignment.findMany({
    where: { active: true, dueAt: { gte: now, lte: in24h } },
    include: {
      class: {
        include: {
          enrollments: { where: { status: "active" }, select: { studentId: true } },
        },
      },
      submissions: { select: { studentId: true } },
    },
  });

  let reminded = 0;
  let assignmentsHit = 0;
  for (const a of assignments) {
    const submitted = new Set(a.submissions.map((s) => s.studentId));
    const missing = a.class.enrollments
      .map((e) => e.studentId)
      .filter((id) => !submitted.has(id));
    if (missing.length === 0) continue;
    assignmentsHit++;
    const n = await notifyStudentIds(missing, {
      type: "due",
      title: "과제 마감이 곧이에요",
      body: `'${a.title}' 과제 마감이 24시간 이내입니다. 아직 제출하지 않았어요.`,
    });
    reminded += n;
  }

  return NextResponse.json({ ok: true, assignmentsHit, reminded });
}
