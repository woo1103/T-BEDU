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
