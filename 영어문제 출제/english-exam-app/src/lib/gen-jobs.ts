// 서버 백그라운드 문항 생성 작업.
// 한 번 실행(run)에 문항 하나를 만들고, 남은 게 있으면 자기 자신을 다시 불러 이어 간다.
// 사슬이 끊겨도(배포·오류) 작업 화면을 열면 멈춘 작업을 다시 깨운다.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { generateVerifiedQuestion, generateVerifiedSet, type GeneratedQuestion } from "@/lib/generate-core";
import { isWritingType } from "@/lib/passage-parser";
import { isSetLeadType } from "@/lib/question-types";

const CIRCLE = ["①", "②", "③", "④", "⑤"];
// 한 문항 처리는 길어도 몇 분 — 이보다 오래 소식이 없으면 멈춘 것으로 본다
export const STALE_MS = 6 * 60_000;
const MAX_ATTEMPTS = 2; // 실패하면 한 번은 저절로 다시 시도

export interface JobSettings {
  difficulty?: string;
  topic?: string;
  passageMode?: string;
  variations?: string[];
}

// 서버가 스스로 다음 단계를 부를 때 쓰는 열쇠(로그인 쿠키 대신)
export function jobKey(jobId: string): string {
  return createHmac("sha256", `genjob:${process.env.AUTH_SECRET ?? ""}`).update(jobId).digest("hex");
}

export function isValidJobKey(jobId: string, key: string | null): boolean {
  if (!key) return false;
  const a = Buffer.from(jobKey(jobId));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function kickJob(origin: string, jobId: string) {
  try {
    await fetch(`${origin}/api/gen-job-run/${jobId}`, {
      method: "POST",
      headers: { "x-gen-job-key": jobKey(jobId) },
    });
  } catch (e) {
    console.error("생성 작업 깨우기 실패:", e);
  }
}

// 남은 문항 하나를 맡는다(같은 문항을 두 곳에서 동시에 만들지 않도록 상태를 조건부로 바꾼다)
async function claimNext(jobId: string) {
  const staleBefore = new Date(Date.now() - STALE_MS);
  const candidates = await prisma.genJobItem.findMany({
    where: {
      jobId,
      OR: [{ status: "pending" }, { status: "running", startedAt: { lt: staleBefore } }],
    },
    orderBy: { order: "asc" },
    take: 3,
  });
  for (const c of candidates) {
    const claimed = await prisma.genJobItem.updateMany({
      where: { id: c.id, status: c.status, attempts: c.attempts },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 1) return { ...c, attempts: c.attempts + 1 };
  }
  return null;
}

async function finishIfDone(jobId: string) {
  const left = await prisma.genJobItem.count({
    where: { jobId, status: { in: ["pending", "running"] } },
  });
  if (left === 0) {
    await prisma.genJob.updateMany({ where: { id: jobId, status: "running" }, data: { status: "done" } });
  }
  return left;
}

// 한 단계: 문항 하나 만들고 저장. 남은 문항 수를 돌려준다.
export async function runJobStep(jobId: string): Promise<number> {
  const job = await prisma.genJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running") return 0;

  const item = await claimNext(jobId);
  if (!item) return finishIfDone(jobId);
  await prisma.genJob.update({ where: { id: jobId }, data: { heartbeatAt: new Date() } });

  const settings = JSON.parse(job.settings) as JobSettings;
  const passage = item.passageId
    ? await prisma.passage.findUnique({ where: { id: item.passageId }, select: { content: true } })
    : null;
  const sourcePassage = passage?.content ?? item.sourceText ?? undefined;

  // 같은 작업에서 같은 지문·유형으로 이미 만든 문항 → 소재·발문이 겹치지 않게 단서로 준다
  const siblings = await prisma.genJobItem.findMany({
    where: {
      jobId,
      status: "done",
      questionType: item.questionType,
      passageId: item.passageId,
      sourceText: item.sourceText,
    },
    select: { questionId: true },
  });
  const prior = siblings.length
    ? await prisma.question.findMany({
        where: { id: { in: siblings.map((s) => s.questionId!).filter(Boolean) } },
        select: { question: true, answer: true, passage: true },
      })
    : [];
  // 같은 유형은 발문이 거의 같아서, 지문 첫머리를 함께 줘야 소재가 겹치지 않는다
  const priorHints = prior.map((p) => ({
    question: `${p.question}\n    지문 첫머리: ${p.passage.replace(/\s+/g, " ").slice(0, 120)}`,
    answer: p.answer || undefined,
  }));

  const params = {
    examType: job.examType,
    questionType: item.questionType,
    difficulty: settings.difficulty,
    topic: settings.topic,
    sourcePassage,
    passageMode: sourcePassage ? settings.passageMode : undefined,
    priorQuestions: priorHints.length ? priorHints : undefined,
    variations: settings.variations?.length ? settings.variations : undefined,
  };

  // 만든 문항 하나를 문제 은행에 저장
  const save = (
    questionType: string,
    r: GeneratedQuestion,
    verified: boolean,
    setId: string | null
  ) => {
    const writing = isWritingType(questionType);
    const choices = writing
      ? []
      : r.choices.map((c, i) => ({ label: CIRCLE[i] ?? `(${i + 1})`, text: c.text, isCorrect: c.isCorrect }));
    const answer = writing ? r.answer : choices.find((c) => c.isCorrect)?.label ?? r.answer;
    return prisma.question.create({
      data: {
        examType: job.examType,
        questionType,
        points: r.points || 2,
        passage: r.passage,
        question: r.question,
        choices: JSON.stringify(choices),
        answer,
        explanation: r.explanation || null,
        difficulty: settings.difficulty || "medium",
        aiGenerated: true,
        source: "AI 생성 (Claude)",
        passageId: item.passageId,
        setId,
        ...(verified ? { verifyStatus: "ok", verifiedAt: new Date() } : {}),
      },
    });
  };

  try {
    let leadId: string;
    if (isSetLeadType(item.questionType)) {
      // 장문 세트: 문항 여러 개를 같은 setId로 저장, 작업 항목엔 첫 문항을 남긴다
      const out = await generateVerifiedSet(params);
      if (!out.ok) throw new Error(out.error);
      const setId = randomUUID();
      const saved = await prisma.$transaction(
        out.members.map((m) => save(m.questionType, m.result, m.verified, setId))
      );
      leadId = saved[0].id;
    } else {
      const out = await generateVerifiedQuestion(params);
      if (!out.ok) throw new Error(out.error);
      leadId = (await save(item.questionType, out.result, out.verified, null)).id;
    }
    await prisma.genJobItem.update({
      where: { id: item.id },
      data: { status: "done", questionId: leadId, error: null },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "생성 실패";
    console.error("백그라운드 생성 실패:", message);
    await prisma.genJobItem.update({
      where: { id: item.id },
      data: { status: item.attempts >= MAX_ATTEMPTS ? "failed" : "pending", error: message.slice(0, 300) },
    });
  }

  await prisma.genJob.update({ where: { id: jobId }, data: { heartbeatAt: new Date() } });
  return finishIfDone(jobId);
}

// 진행 중인데 오래 소식이 없는 작업인가(사슬이 끊겼을 때 다시 깨우기)
export function isStalled(job: { status: string; heartbeatAt: Date }): boolean {
  return job.status === "running" && Date.now() - job.heartbeatAt.getTime() > STALE_MS;
}

// 화면 표시용 요약
export function summarizeItems(items: { status: string }[]) {
  const count = (s: string) => items.filter((i) => i.status === s).length;
  return { total: items.length, done: count("done"), failed: count("failed"), running: count("running"), pending: count("pending") };
}
