import { NextRequest, NextResponse } from "next/server";
import { generateQuestion } from "@/lib/claude";
import { getSystemPrompt } from "@/lib/prompts";
import { getQuestionTypeInfo } from "@/lib/question-types";
import { prisma } from "@/lib/db";

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

export async function POST(request: NextRequest) {
  try {
    const { examType, questionType, difficulty, topic, sourcePassage, passageMode, priorQuestions } = await request.json();

    if (!examType || !questionType) {
      return NextResponse.json(
        { error: "시험 유형과 문제 유형을 선택해주세요." },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요." },
        { status: 500 }
      );
    }

    const basePrompt = getSystemPrompt(examType, questionType, difficulty, sourcePassage, passageMode, priorQuestions);
    if (!basePrompt) {
      return NextResponse.json(
        { error: `이 문제 유형(${questionType})에 대한 프롬프트가 아직 준비되지 않았습니다.` },
        { status: 400 }
      );
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

    const result = await generateQuestion(systemPrompt, userPrompt);

    return NextResponse.json(result);
  } catch (err) {
    console.error("AI 생성 오류:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "AI 문제 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
