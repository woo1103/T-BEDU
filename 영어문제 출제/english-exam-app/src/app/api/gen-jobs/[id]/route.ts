import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { getQuestionTypeInfo } from "@/lib/question-types";
import { isStalled, kickJob, summarizeItems } from "@/lib/gen-jobs";

async function loadOwned(id: string) {
  const staff = await requireStaff();
  if (!staff) return { error: NextResponse.json({ error: "권한 없음" }, { status: 403 }) };
  const job = await prisma.genJob.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!job || (staff.role !== "admin" && job.createdById !== staff.sub)) {
    return { error: NextResponse.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 }) };
  }
  return { job };
}

// 작업 진행 상황 + 만든 문항(멈춰 있으면 다시 깨운다)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { job, error } = await loadOwned(id);
  if (error) return error;
  if (isStalled(job)) {
    const origin = request.nextUrl.origin;
    after(() => kickJob(origin, id));
  }

  const qIds = job.items.map((i) => i.questionId).filter((x): x is string => !!x);
  const questions = qIds.length
    ? await prisma.question.findMany({
        where: { id: { in: qIds } },
        select: { id: true, question: true, verifyStatus: true },
      })
    : [];
  const qById = new Map(questions.map((q) => [q.id, q]));

  return NextResponse.json({
    id: job.id,
    title: job.title,
    status: job.status,
    examType: job.examType,
    createdAt: job.createdAt,
    ...summarizeItems(job.items),
    items: job.items.map((i) => ({
      id: i.id,
      typeName: getQuestionTypeInfo(job.examType, i.questionType)?.name ?? i.questionType,
      status: i.status,
      error: i.error,
      questionId: i.questionId,
      question: i.questionId ? qById.get(i.questionId)?.question ?? null : null,
      verified: i.questionId ? qById.get(i.questionId)?.verifyStatus === "ok" : false,
    })),
  });
}

// action "retry": 실패한 문항(멈춘 작업이면 남은 문항도) 다시 / "cancel": 남은 문항 멈추기
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { job, error } = await loadOwned(id);
  if (error) return error;
  const { action } = await request.json().catch(() => ({}));
  const origin = request.nextUrl.origin;

  if (action === "retry") {
    const failed = await prisma.genJobItem.updateMany({
      where: { jobId: id, status: "failed" },
      data: { status: "pending", attempts: 0, error: null },
    });
    const resumed = await prisma.genJobItem.updateMany({
      where: { jobId: id, status: "cancelled" },
      data: { status: "pending" },
    });
    if (failed.count + resumed.count === 0 && job.status !== "running") {
      return NextResponse.json({ error: "다시 할 문항이 없어요." }, { status: 400 });
    }
    await prisma.genJob.update({ where: { id }, data: { status: "running", heartbeatAt: new Date() } });
    after(() => kickJob(origin, id));
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    await prisma.$transaction([
      prisma.genJobItem.updateMany({ where: { jobId: id, status: "pending" }, data: { status: "cancelled" } }),
      prisma.genJob.update({ where: { id }, data: { status: "cancelled" } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 요청" }, { status: 400 });
}
