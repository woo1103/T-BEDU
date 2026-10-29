import { generateQuestion, solveQuestion } from "@/lib/claude";
import { getSystemPrompt } from "@/lib/prompts";
import { getQuestionTypeInfo } from "@/lib/question-types";
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

// 문항 1개 생성 → (1) 마커 구조 (2) 정답 1개 (3) 독립 풀이 검수. 실패하면 사유를 붙여 재생성(최대 3회).
// 화면의 '생성' 요청과 서버 백그라운드 생성 작업이 같이 쓴다.
export async function generateVerifiedQuestion(params: GenerateParams): Promise<GenerateOutcome> {
  const { examType, questionType, difficulty = "medium", topic, sourcePassage, passageMode, priorQuestions, variations } = params;
  const basePrompt = getSystemPrompt(examType, questionType, difficulty, sourcePassage, passageMode, priorQuestions, variations);
  if (!basePrompt) {
    return { ok: false, status: 400, error: `이 문제 유형(${questionType})에 대한 프롬프트가 아직 준비되지 않았습니다.` };
  }
  const directives = await getActiveDirectives(examType, questionType);
  const systemPrompt = basePrompt + directives;

  const typeInfo = getQuestionTypeInfo(examType, questionType);
  const difficultyMap = { easy: "하 (쉬움)", medium: "중 (보통)", hard: "상 (어려움)" };

  let userPrompt = `난이도: ${difficultyMap[difficulty as keyof typeof difficultyMap] || "중"}`;
  if (topic) {
    userPrompt += `\n주제/키워드: ${topic}`;
  }
  if (typeInfo) {
    userPrompt += `\n문제 유형: ${typeInfo.number}번 ${typeInfo.name} (${typeInfo.nameEn})`;
  }
  if (sourcePassage) {
    userPrompt += `\n\n위 교과서 원본 지문을 기반으로 "${typeInfo?.name || questionType}" 유형 문제를 1개 생성해주세요.`;
  } else {
    userPrompt += "\n\n위 조건에 맞는 영어 문제를 1개 생성해주세요.";
  }

  const CIRCLE = ["①", "②", "③", "④", "⑤"];
  const writing = isWritingType(questionType);

  // 선지에 라벨을 붙여 마커-only 선지(①~⑤)를 ①→⑤ 순으로 정렬한 뒤 {text,isCorrect}로 되돌린다.
  // (검수·저장·미리보기가 모두 같은 순서를 보도록)
  const normalizeChoices = (choices: { text: string; isCorrect: boolean }[]) =>
    normalizeMarkerChoices(
      choices.map((c, i) => ({ label: CIRCLE[i] ?? "", text: c.text ?? "", isCorrect: !!c.isCorrect }))
    ).map((c) => ({ text: c.text, isCorrect: c.isCorrect }));

  // 생성 → (1) 마커 구조 (2) 정답 1개 (3) 독립 풀이 검수. 실패하면 사유를 붙여 재생성(최대 3회).
  const MAX_ATTEMPTS = 3;
  let feedback = "";
  let lastReason = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await generateQuestion(systemPrompt + feedback, userPrompt);

    if (writing) return { ok: true, result, verified: false };

    result.choices = normalizeChoices(reconcileCorrect(result.choices, result.answer));
    const valChoices = result.choices.map((c, i) => ({ label: CIRCLE[i] ?? "", isCorrect: c.isCorrect }));

    if (isMarkerMappedType(questionType)) {
      const check = validateQuestionStructure(questionType, result.passage, valChoices);
      if (!check.ok) {
        lastReason = `구조 오류: ${check.reason}`;
        feedback =
          "\n\n[재생성 지시] 직전 생성물이 구조 검증에 실패했다(" + check.reason + "). 반드시 지문에 ①~⑤ 마커 5곳(또는 순서=(A)(B)(C), 삽입=①~⑤)을 정확히 넣고, 선지 5개와 정답이 지문 마커와 1:1로 대응하게 하라.";
        continue;
      }
    }

    const single = validateSingleAnswer(valChoices);
    if (!single.ok) {
      lastReason = `정답 오류: ${single.reason}`;
      feedback =
        "\n\n[재생성 지시] 직전 생성물의 정답 표시가 잘못됐다(" + single.reason + "). choices 중 정확히 1개만 \"isCorrect\": true 로 하고, answer에도 같은 번호를 적어라.";
      continue;
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
        lastReason = `검수 불일치: ${verdict.note}`;
        feedback =
          "\n\n[재생성 지시] 직전 문항을 독립적으로 풀어 본 결과 " + verdict.note +
          "\n정답이 지문 근거로 명확히 하나로만 정해지고, 오답 선지는 분명히 틀리도록 새로 출제하라.";
        continue;
      }
      verified = true;
    } catch (e) {
      // 검수 호출 자체가 실패하면(네트워크·파싱) 생성 결과를 막지 않는다 — (1)(2) 검증은 통과한 상태(미검수로 저장됨)
      console.error("문항 검수 실패(생성 결과는 사용):", e);
    }

    result.answer = CIRCLE[intended] ?? result.answer;
    // verified: 독립 풀이 검수까지 통과했는지
    return { ok: true, result, verified };
  }

  return { ok: false, status: 422, error: `문항 검증 ${MAX_ATTEMPTS}회 실패(${lastReason}). 다시 시도해주세요.` };
}
