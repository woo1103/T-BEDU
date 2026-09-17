import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateQuestion(
  systemPrompt: string,
  userPrompt: string
): Promise<{
  passage: string;
  question: string;
  choices: { text: string; isCorrect: boolean }[];
  explanation: string;
  points: number;
}> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  // JSON 블록 추출
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI 응답에서 문제 데이터를 파싱할 수 없습니다.");
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  const parsed = JSON.parse(jsonStr);

  return {
    passage: parsed.passage || "",
    question: parsed.question || "",
    choices: parsed.choices || [],
    explanation: parsed.explanation || "",
    points: parsed.points || 2,
  };
}

// 서술형(주관식) 자동 채점: 모범답안 + 채점기준 대비 학생답안을 평가한다.
export async function gradeWritingAnswer(input: {
  question: string;
  passage?: string;
  modelAnswer: string;
  rubric?: string;
  studentAnswer: string;
  maxPoints: number;
}): Promise<{ awardedPoints: number; feedback: string }> {
  const { question, passage, modelAnswer, rubric, studentAnswer, maxPoints } = input;

  const system = `당신은 대한민국 영어 시험의 서술형 문항을 채점하는 엄정한 채점관입니다.
모범답안과 채점기준을 근거로 학생답안을 평가해 0점부터 만점까지 부분점수를 부여하세요.
- 철자·문법 오류는 의미 전달을 해치지 않으면 감점을 최소화합니다(채점기준에 명시된 경우 제외).
- 핵심 내용/키워드 포함 여부, 조건 충족 여부를 우선합니다.
- 빈 답안이거나 문항과 무관하면 0점입니다.
- 반드시 아래 JSON 형식만 출력하세요. 다른 텍스트는 넣지 마세요.
{"awardedPoints": <0 이상 ${maxPoints} 이하 정수>, "feedback": "<한국어로 1~2문장 채점 근거>"}`;

  const user = `[문항] ${question}
${passage ? `\n[지문]\n${passage}\n` : ""}
[모범답안]
${modelAnswer || "(제공되지 않음)"}

[채점기준]
${rubric || "(제공되지 않음)"}

[배점] ${maxPoints}점

[학생답안]
${studentAnswer || "(빈 답안)"}

위 기준으로 채점하여 JSON으로만 답하세요.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI 채점 응답을 파싱할 수 없습니다.");
  }
  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  let awarded = Number(parsed.awardedPoints);
  if (!Number.isFinite(awarded)) awarded = 0;
  awarded = Math.max(0, Math.min(maxPoints, Math.round(awarded)));
  return {
    awardedPoints: awarded,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
  };
}
