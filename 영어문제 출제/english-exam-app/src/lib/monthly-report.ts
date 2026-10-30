// 학부모 월간 리포트: 한 달(한국 시간) 동안의 과제·정답률·영역·영상·오답 복습·선생님 코멘트
import { prisma } from "@/lib/db";
import { areaNamesForAnswers, computeBreakdown } from "@/lib/achievement";
import { areaForQuestionType } from "@/lib/english-areas";
import { monthRange, monthlyRates, shiftMonth, type MonthlyReport } from "@/lib/report-format";

export { isValidMonth, reportsToCsv, type MonthlyReport } from "@/lib/report-format";

const rate = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : null);

// 학생 여러 명의 한 달 리포트
export async function loadMonthlyReports(studentIds: string[], month: string): Promise<MonthlyReport[]> {
  const { start, end } = monthRange(month);
  const trendStart = monthRange(shiftMonth(month, -5)).start;

  const out: MonthlyReport[] = [];
  for (const id of studentIds) {
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: { enrollments: { where: { status: "active" }, include: { class: { select: { id: true, name: true } } } } },
    });
    if (!profile) continue;
    const classIds = profile.enrollments.map((e) => e.class.id);

    // 과제: 이번 달에 내주었거나 마감이 이번 달인 것(지정 학생 과제는 대상일 때만)
    const asgs = await prisma.assignment.findMany({
      where: {
        classId: { in: classIds },
        OR: [{ assignedAt: { gte: start, lt: end } }, { dueAt: { gte: start, lt: end } }],
      },
      include: {
        submissions: { where: { studentId: id }, orderBy: { submittedAt: "desc" }, take: 1 },
      },
      orderBy: { assignedAt: "asc" },
    });
    const mine = asgs.filter((a) => {
      if (!a.studentIds) return true;
      try {
        const ids = JSON.parse(a.studentIds) as string[];
        return !Array.isArray(ids) || ids.length === 0 || ids.includes(id);
      } catch {
        return true;
      }
    });
    const list = mine.map((a) => {
      const sub = a.submissions[0];
      return {
        title: a.title,
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        submitted: !!sub?.submittedAt,
        score: sub?.submittedAt ? sub.score : null,
        totalPoints: sub?.submittedAt ? sub.totalPoints : null,
      };
    });
    const submittedCount = list.filter((x) => x.submitted).length;

    // 정답률: 제출일 기준, 최근 6달
    const answers = await prisma.answer.findMany({
      where: { submission: { studentId: id, submittedAt: { gte: trendStart, lt: end } } },
      select: { refId: true, refType: true, isCorrect: true, submission: { select: { submittedAt: true } } },
    });
    const flat = answers.map((a) => ({ ...a, submittedAt: a.submission.submittedAt! }));
    const trend = monthlyRates(flat, month, 6);
    const thisMonth = flat.filter((a) => a.submittedAt >= start && a.submittedAt < end);
    const correct = thisMonth.filter((a) => a.isCorrect).length;

    // 영역: 태그가 없으면 문항 유형으로(어법·대의 파악 등)
    const areaMap = await areaNamesForAnswers(thisMonth);
    const qIds = thisMonth.filter((a) => a.refType === "question" && !areaMap.has(a.refId)).map((a) => a.refId);
    if (qIds.length) {
      const qs = await prisma.question.findMany({ where: { id: { in: [...new Set(qIds)] } }, select: { id: true, questionType: true } });
      for (const q of qs) {
        const area = areaForQuestionType(q.questionType);
        if (area) areaMap.set(q.id, [area]);
      }
    }
    const breakdown = computeBreakdown(thisMonth, areaMap);
    const areas = breakdown.areas.filter((a) => a.total >= 2);

    // 영상
    const vas = await prisma.videoAssignment.findMany({ where: { classId: { in: classIds } }, select: { videoId: true, createdAt: true } });
    const assignedIds = [...new Set(vas.filter((v) => v.createdAt < end).map((v) => v.videoId))];
    const progress = await prisma.watchProgress.findMany({ where: { studentId: id }, select: { videoId: true, completed: true, updatedAt: true } });
    const done = new Set(progress.filter((p) => p.completed && p.updatedAt < end).map((p) => p.videoId));

    // 오답 복습
    const notes = await prisma.wrongNote.findMany({
      where: { studentId: id, createdAt: { gte: start, lt: end } },
      select: { resolved: true },
    });
    const practice = await prisma.practiceAttempt.findMany({
      where: { studentId: id, answeredAt: { gte: start, lt: end } },
      select: { isCorrect: true },
    });

    const comments = await prisma.teacherComment.findMany({
      where: { studentId: id, updatedAt: { gte: start, lt: end } },
      orderBy: { updatedAt: "desc" },
      select: { body: true },
    });

    out.push({
      month,
      student: { id, name: profile.name, grade: profile.grade, classes: profile.enrollments.map((e) => e.class.name) },
      assignments: { assigned: list.length, submitted: submittedCount, rate: rate(submittedCount, list.length), list },
      accuracy: {
        rate: rate(correct, thisMonth.length),
        correct,
        total: thisMonth.length,
        prevRate: trend[trend.length - 2]?.rate ?? null,
      },
      trend,
      areas,
      weak: areas.filter((a) => a.rate < 60),
      strong: areas.filter((a) => a.rate >= 80),
      videos: {
        assigned: assignedIds.length,
        completed: assignedIds.filter((v) => done.has(v)).length,
        watchedThisMonth: progress.filter((p) => p.updatedAt >= start && p.updatedAt < end).length,
      },
      wrongNotes: {
        created: notes.length,
        resolved: notes.filter((n) => n.resolved).length,
        practiced: practice.length,
        practiceCorrect: practice.filter((p) => p.isCorrect).length,
      },
      comments: comments.map((c) => c.body),
    });
  }
  return out;
}

