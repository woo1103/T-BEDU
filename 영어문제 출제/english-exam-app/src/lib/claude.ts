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
  answer: string;
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
    answer: typeof parsed.answer === "string" ? parsed.answer : String(parsed.answer ?? ""),
    explanation: parsed.explanation || "",
    points: parsed.points || 2,
  };
}

// 생성된 객관식 문항을 정답을 모르는 상태에서 독립적으로 풀어 본다.
// 출제 의도와 다른 답이 나오거나, 맞는 선지가 없거나 여럿이면 문항 결함으로 본다.
export async function solveQuestion(input: {
  passage: string;
  question: string;
  choices: string[];
}): Promise<{ answerIndex: number; valid: "one" | "none" | "multiple"; reason: string }> {
  const labels = ["①", "②", "③", "④", "⑤"];
  const choiceLines = input.choices
    .map((c, i) => `${labels[i] ?? `(${i + 1})`} ${c}`)
    .join("\n");

  const system = `당신은 한국 고등학교 영어 시험 문항을 검토하는 꼼꼼한 검수자입니다.
주어진 문항을 직접 풀고, 정답이 될 수 있는 선지를 모두 따져 보세요.
- 정답이 정확히 1개면 valid="one", answer에 그 번호(1~5)
- 어떤 선지도 정답이 될 수 없으면 valid="none", answer=0
- 정답이 될 수 있는 선지가 2개 이상이면 valid="multiple", answer에 가장 적절한 번호
반드시 아래 JSON만 출력하세요.
{"answer": <0~5 정수>, "valid": "one"|"none"|"multiple", "reason": "<한국어 1~2문장 근거>"}`;

  const user = `[지문]
${input.passage || "(지문 없음)"}

[발문]
${input.question}

[선지]
${choiceLines}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("검수 응답을 파싱할 수 없습니다.");
  const parsed = JSON.parse(m[1] || m[0]);
  const n = Number(parsed.answer);
  const valid = parsed.valid === "none" || parsed.valid === "multiple" ? parsed.valid : "one";
  return {
    answerIndex: Number.isInteger(n) && n >= 1 && n <= input.choices.length ? n - 1 : -1,
    valid,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
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

// 정답지(이미지/PDF)를 읽어 문항별 정답을 자동 추출한다.
export async function recognizeAnswerKey(input: {
  base64: string;
  mediaType: string; // image/png|jpeg|webp|gif 또는 application/pdf
  expectedCount?: number;
}): Promise<{ items: { number: number; answer: string; objective: boolean }[] }> {
  const { base64, mediaType, expectedCount } = input;
  const isPdf = mediaType === "application/pdf";

  const mediaBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as
            | "image/png"
            | "image/jpeg"
            | "image/webp"
            | "image/gif",
          data: base64,
        },
      };

  const instruction = `이 정답지를 읽고 각 문항의 번호와 정답을 추출하세요.
- 객관식 정답은 반드시 ①②③④⑤ 원문자로 표기하세요(1→①, 2→②, 3→③, 4→④, 5→⑤). 이 경우 objective=true.
- 주관식(단답형) 정답은 숫자나 텍스트를 그대로 적고 objective=false.
${expectedCount ? `- 정답지에는 총 ${expectedCount}문항이 있습니다.` : ""}
- 배점/점수 표기는 무시하고 "정답"만 추출하세요.
- 번호 순서대로 빠짐없이 정리하세요.
반드시 아래 JSON 형식만 출력하세요(다른 텍스트 금지):
{"items":[{"number":1,"answer":"③","objective":true},{"number":2,"answer":"42","objective":false}]}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      { role: "user", content: [mediaBlock, { type: "text", text: instruction }] },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("정답 인식 결과를 파싱할 수 없습니다.");
  const parsed = JSON.parse(m[1] || m[0]);
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems.map(
    (it: { number?: number; answer?: string; objective?: boolean }, i: number) => ({
      number: typeof it.number === "number" ? it.number : i + 1,
      answer: String(it.answer ?? "").trim(),
      objective: it.objective !== false,
    })
  );
  return { items };
}

// 수학 문제 이미지/PDF를 읽어 개별 문항으로 분리하고 LaTeX·정답·메타를 추출한다.
export interface ExtractedMathProblem {
  number?: number;
  problemLatex: string;
  answer?: string;
  answerLatex?: string;
  solution?: string;
  unit?: string;
  difficulty?: string;
  // 쪽 이미지 안 위치(0~1 비율, [x0, y0, x1, y1]) — 브라우저가 이 영역을 잘라 저장
  box?: [number, number, number, number];
  figureBox?: [number, number, number, number];
}

// 모델이 준 0~1000 좌표를 0~1 비율로. 형식이 틀리면 버린다.
export function parseBox(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return undefined;
  }
  const [x0, y0, x1, y1] = (v as number[]).map((n) => Math.min(1000, Math.max(0, n)) / 1000);
  if (x1 - x0 < 0.02 || y1 - y0 < 0.01) return undefined;
  return [x0, y0, x1, y1];
}

export async function extractMathProblems(input: {
  base64: string;
  mediaType: string;
  hint?: { source?: string; grade?: string };
}): Promise<{ problems: ExtractedMathProblem[] }> {
  const { base64, mediaType, hint } = input;
  const isPdf = mediaType === "application/pdf";
  const mediaBlock = isPdf
    ? {
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: base64,
        },
      };

  const instruction = `이 이미지는 한국 고등학교 수학 문제지의 한 쪽입니다. 각 문항을 분리해 추출하세요.
- 수식은 모두 LaTeX로 표기하되, 인라인은 $...$, 블록은 $$...$$ 로 감싼다. 객관식 선지(①~⑤)도 problemLatex에 포함한다.
- 그래프·도형·표가 있으면 problemLatex 안에 "[그림]" 한 줄만 남긴다(그림은 이미지로 따로 잘라 보존됨).
- 정답은 적지 않는다(answer 생략). 풀이가 인쇄돼 있으면 solution에 넣는다(없으면 생략).
- 단원(unit)과 난이도(difficulty: 하|중|상|킬러)를 추정해 넣는다(모르면 생략).
- 위치: 이미지 왼쪽 위를 (0,0), 오른쪽 아래를 (1000,1000)으로 보고
  · box: 문항 번호부터 마지막 선지·조건까지 문항 전체를 감싸는 사각형 [x0,y0,x1,y1] (정수)
  · figureBox: 그림·그래프·도형·표가 있을 때 그것만 감싸는 사각형 [x0,y0,x1,y1] (없으면 생략)
  · 2단 편집이면 각 문항은 자기 단 안에만 있다. 이웃 문항이 겹치지 않게 잡는다.
- 쪽 맨 위에 이전 쪽에서 이어진 문항의 일부만 있으면 그 부분은 제외한다.
- 정답표·해설만 있는 쪽이면 {"problems":[]} 를 출력한다.
${hint?.grade ? `- 학년 힌트: ${hint.grade}` : ""}
${hint?.source ? `- 출처 힌트: ${hint.source}` : ""}
반드시 아래 JSON만 출력(다른 텍스트 금지):
{"problems":[{"number":1,"problemLatex":"...","solution":"...","unit":"...","difficulty":"중","box":[60,120,480,430],"figureBox":[120,260,420,400]}]}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: [mediaBlock, { type: "text", text: instruction }] }],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("문제 인식 결과를 파싱할 수 없습니다.");
  const parsed = JSON.parse(m[1] || m[0]);
  const raw = Array.isArray(parsed.problems) ? parsed.problems : [];
  const problems: ExtractedMathProblem[] = raw
    .filter((p: { problemLatex?: string }) => (p.problemLatex ?? "").trim())
    .map((p: ExtractedMathProblem & { box?: unknown; figureBox?: unknown }, i: number) => ({
      number: typeof p.number === "number" ? p.number : i + 1,
      problemLatex: String(p.problemLatex ?? "").trim(),
      // 정답은 이미지 인식에서 받지 않는다: 시험해 보니 인쇄되지 않은 정답을 스스로 풀어 채우고 틀리기도 함
      // → 채점용 정답은 학습지를 만들 때 선생님이 확인·입력
      answer: undefined,
      answerLatex: undefined,
      solution: p.solution ? String(p.solution).trim() : undefined,
      unit: p.unit ? String(p.unit).trim() : undefined,
      difficulty: p.difficulty ? String(p.difficulty).trim() : undefined,
      box: parseBox(p.box),
      figureBox: parseBox(p.figureBox),
    }));
  return { problems };
}
