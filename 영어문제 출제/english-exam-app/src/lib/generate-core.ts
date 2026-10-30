import { generateQuestion, generateQuestionSet, solveQuestion } from "@/lib/claude";
import { getSystemPrompt } from "@/lib/prompts";
import { getQuestionTypeInfo, isSetLeadType, SET_DEFS } from "@/lib/question-types";
import { prisma } from "@/lib/db";
import {
  isMarkerMappedType,
  reconcileCorrect,
  validateQuestionStructure,
  validateSingleAnswer,
} from "@/lib/question-validate";
import { isWritingType, normalizeMarkerChoices } from "@/lib/passage-parser";
import { judgeSolve } from "@/lib/verify";

export interface GenerateParams {
  examType: string;
  questionType: string;
  difficulty?: string;
  topic?: string;
  sourcePassage?: string;
  passageMode?: string;
  priorQuestions?: { question: string; answer?: string }[];
  variations?: string[];
}

export type GeneratedQuestion = Awaited<ReturnType<typeof generateQuestion>>;

export type GenerateOutcome =
  | { ok: true; result: GeneratedQuestion; verified: boolean }
  | { ok: false; status: number; error: string };

async function getActiveDirectives(examType: string, questionType: string): Promise<string> {
  const list = await prisma.promptDirective.findMany({
    where: {
      enabled: true,
      OR: [
        { scope: "global" },
        { scope: "examType", scopeKey: examType },
        { scope: "questionType", scopeKey: questionType },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (list.length === 0) return "";
  return (
    "\n\n[관리자 지시문 — 반드시 준수]\n" +
    list.map((d, i) => `${i + 1}. (${d.title}) ${d.body}`).join("\n")
  );
}

type Prompts = { ok: true; systemPrompt: string; userPrompt: string } | { ok: false; status: number; error: string };

// 출제 지침(시스템) + 요청(사용자) 프롬프트 조립 — 단일 문항과 장문 세트가 같이 쓴다
async function buildPrompts(params: GenerateParams): Promise<Prompts> {
  const { examType, questionType, difficulty = "medium", topic, sourcePassage, passageMode, priorQuestions, variations } = params;
  const basePrompt = getSystemPrompt(examType, questionType, difficulty, sourcePassage, passageMode, priorQuestions, variations);
  if (!basePrompt) {
    return { ok: false, status: 400, error: `이 문제 유형(${questionType})에 대한 프롬프트가 아직 준비되지 않았습니다.` };
  }
  const directives = await getActiveDirectives(examType, questionType);

  const typeInfo = getQuestionTypeInfo(examType, questionType);
  const difficultyMap = { easy: "하 (쉬움)", medium: "중 (보통)", hard: "상 (어려움)" };
  const what = isSetLeadType(questionType) ? "장문 세트를 1개" : "영어 문제를 1개";

  let userPrompt = `난이도: ${difficultyMap[difficulty as keyof typeof difficultyMap] || "중"}`;
  if (topic) {
    userPrompt += `\n주제/키워드: ${topic}`;
  }
  if (typeInfo) {
    userPrompt += `\n문제 유형: ${typeInfo.number}번 ${typeInfo.name} (${typeInfo.nameEn})`;
  }
  if (sourcePassage) {
    userPrompt += `\n\n위 교과서 원본 지문을 기반으로 "${typeInfo?.name || questionType}" 유형 ${what} 생성해주세요.`;
  } else {
    userPrompt += `\n\n위 조건에 맞는 ${what} 생성해주세요.`;
  }
  return { ok: true, systemPrompt: basePrompt + directives, userPrompt };
}

const CIRCLE = ["①", "②", "③", "④", "⑤"];

// 선지에 라벨을 붙여 마커-only 선지(①~⑤)를 ①→⑤ 순으로 정렬한 뒤 {text,isCorrect}로 되돌린다.
// (검수·저장·미리보기가 모두 같은 순서를 보도록)
const normalizeChoices = (choices: { text: string; isCorrect: boolean }[]) =>
  normalizeMarkerChoices(
    choices.map((c, i) => ({ label: CIRCLE[i] ?? "", text: c.text ?? "", isCorrect: !!c.isCorrect }))
  ).map((c) => ({ text: c.text, isCorrect: c.isCorrect }));

type CheckOutcome = { ok: true; verified: boolean } | { ok: false; reason: string; feedback: string };

// 생성물 하나 검사: (1) 마커 구조 (2) 정답 1개 (3) 독립 풀이 검수. result의 선지·정답을 정리한다.
async function checkGenerated(questionType: string, result: GeneratedQuestion): Promise<CheckOutcome> {
  result.choices = normalizeChoices(reconcileCorrect(result.choices, result.answer));
  const valChoices = result.choices.map((c, i) => ({ label: CIRCLE[i] ?? "", isCorrect: c.isCorrect }));

  if (isMarkerMappedType(questionType)) {
    const check = validateQuestionStructure(questionType, result.passage, valChoices);
    if (!check.ok) {
      return {
        ok: false,
        reason: `구조 오류: ${check.reason}`,
        feedback:
          "\n\n[재생성 지시] 직전 생성물이 구조 검증에 실패했다(" +
          check.reason +
          "). 지시한 passage 형식(①~⑤ 마커·(a)~(e)·(A)(B)(C)·도표 데이터)을 정확히 지키고, 선지 5개와 정답이 지문과 1:1로 대응하게 하라.",
      };
    }
  }

  const single = validateSingleAnswer(valChoices);
  if (!single.ok) {
    return {
      ok: false,
      reason: `정답 오류: ${single.reason}`,
      feedback:
        "\n\n[재생성 지시] 직전 생성물의 정답 표시가 잘못됐다(" +
        single.reason +
        '). choices 중 정확히 1개만 "isCorrect": true 로 하라.',
    };
  }

  const intended = result.choices.findIndex((c) => c.isCorrect);
  let verified = false;
  try {
    const solved = await solveQuestion({
      passage: result.passage,
      question: result.question,
      choices: result.choices.map((c) => c.text),
    });
    const verdict = judgeSolve(intended, solved);
    if (!verdict.ok) {
      return {
        ok: false,
        reason: `검수 불일치: ${verdict.note}`,
        feedback:
          "\n\n[재생성 지시] 직전 문항을 독립적으로 풀어 본 결과 " +
          verdict.note +
          "\n정답이 지문 근거로 명확히 하나로만 정해지고, 오답 선지는 분명히 틀리도록 새로 출제하라.",
      };
    }
    verified = true;
  } catch (e) {
    // 검수 호출 자체가 실패하면(네트워크·파싱) 생성 결과를 막지 않는다 — (1)(2) 검증은 통과한 상태(미검수로 저장됨)
    console.error("문항 검수 실패(생성 결과는 사용):", e);
  }
  result.answer = CIRCLE[intended] ?? result.answer;
  return { ok: true, verified };
}

const MAX_ATTEMPTS = 3;

// 문항 1개 생성 → 검사. 실패하면 사유를 붙여 재생성(최대 3회).
// 화면의 '생성' 요청과 서버 백그라운드 생성 작업이 같이 쓴다.
export async function generateVerifiedQuestion(params: GenerateParams): Promise<GenerateOutcome> {
  if (isSetLeadType(params.questionType)) {
    return { ok: false, status: 400, error: "장문 세트는 '서버에 맡기기'나 시험지 자동 구성으로 만들어 주세요." };
  }
  const prompts = await buildPrompts(params);
  if (!prompts.ok) return prompts;
  const writing = isWritingType(params.questionType);

  let feedback = "";
  let lastReason = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await generateQuestion(prompts.systemPrompt + feedback, prompts.userPrompt);
    if (writing) return { ok: true, result, verified: false };

    const check = await checkGenerated(params.questionType, result);
    if (!check.ok) {
      lastReason = check.reason;
      feedback = check.feedback;
      continue;
    }
    return { ok: true, result, verified: check.verified };
  }

  return { ok: false, status: 422, error: `문항 검증 ${MAX_ATTEMPTS}회 실패(${lastReason}). 다시 시도해주세요.` };
}

export type SetOutcome =
  | { ok: true; members: { questionType: string; result: GeneratedQuestion; verified: boolean }[] }
  | { ok: false; status: number; error: string };

// 장문 세트 생성: 지문 하나 + 세트 문항 전부를 한 번에 만들고, 문항마다 따로 검사한다.
// 하나라도 실패하면 사유를 붙여 세트 전체를 다시 만든다(최대 2회 — 세트 한 번에 1~2분이라 서버 한 단계 300초 안에).
const SET_ATTEMPTS = 2;
export async function generateVerifiedSet(params: GenerateParams): Promise<SetOutcome> {
  const memberTypes = SET_DEFS[params.questionType];
  if (!memberTypes) return { ok: false, status: 400, error: `장문 세트 유형이 아닙니다: ${params.questionType}` };
  const prompts = await buildPrompts(params);
  if (!prompts.ok) return prompts;

  let feedback = "";
  let lastReason = "";
  for (let attempt = 1; attempt <= SET_ATTEMPTS; attempt++) {
    const set = await generateQuestionSet(prompts.systemPrompt + feedback, prompts.userPrompt);
    if (!set.passage.trim() || set.questions.length !== memberTypes.length) {
      lastReason = `세트 구성 오류: 문항 ${set.questions.length}개(${memberTypes.length}개 필요)`;
      feedback = `\n\n[재생성 지시] passage와 questions ${memberTypes.length}개(${memberTypes.join(", ")})를 지시한 순서대로 모두 만들어라.`;
      continue;
    }

    const members: { questionType: string; result: GeneratedQuestion; verified: boolean }[] = [];
    let failed = false;
    for (let i = 0; i < memberTypes.length; i++) {
      const q = set.questions[i];
      const result: GeneratedQuestion = {
        passage: set.passage,
        question: q.question,
        choices: q.choices,
        answer: q.answer,
        explanation: q.explanation,
        points: q.points,
      };
      const check = await checkGenerated(memberTypes[i], result);
      if (!check.ok) {
        const label = getQuestionTypeInfo(params.examType, memberTypes[i])?.number ?? i + 1;
        lastReason = `${label}번 ${check.reason}`;
        feedback =
          check.feedback.replace("[재생성 지시] ", `[재생성 지시] (${label}번 문항) `) + "\n세트 전체를 새로 만들어라.";
        failed = true;
        break;
      }
      members.push({ questionType: memberTypes[i], result, verified: check.verified });
    }
    if (!failed) return { ok: true, members };
  }

  return { ok: false, status: 422, error: `장문 세트 검증 ${SET_ATTEMPTS}회 실패(${lastReason}). 다시 시도해주세요.` };
}
