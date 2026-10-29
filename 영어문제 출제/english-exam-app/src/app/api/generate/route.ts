import { NextRequest, NextResponse } from "next/server";
import { generateVerifiedQuestion } from "@/lib/generate-core";
import { signVerified } from "@/lib/verify";

export async function POST(request: NextRequest) {
  try {
    const { examType, questionType, difficulty, topic, sourcePassage, passageMode, priorQuestions, variations } = await request.json();

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

    const out = await generateVerifiedQuestion({ examType, questionType, difficulty, topic, sourcePassage, passageMode, priorQuestions, variations });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
    // 검수 통과한 내용 그대로 저장되면 '검수 통과'로 기록되도록 서명을 붙인다
    return NextResponse.json(out.verified ? { ...out.result, verifySig: signVerified(out.result) } : out.result);
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
