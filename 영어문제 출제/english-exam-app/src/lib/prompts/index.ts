import { getSuneungPrompt, getSuneungDifficulty } from "./suneung";
import { getNaesinPrompt } from "./naesin";

export function getSystemPrompt(
  examType: string,
  questionType: string,
  difficulty: string,
  sourcePassage?: string,
  passageMode?: string,
  priorQuestions?: { question: string; answer?: string }[]
): string | null {
  let basePrompt: string | null = null;

  switch (examType) {
    case "suneung":
      basePrompt = getSuneungPrompt(questionType);
      if (basePrompt) {
        basePrompt += "\n" + getSuneungDifficulty(difficulty);
      }
      break;
    case "naesin":
      basePrompt = getNaesinPrompt(questionType, difficulty);
      break;
    case "toeic":
      return null;
    default:
      return null;
  }

  // 내신 지문 학습: 원본 지문이 제공된 경우 프롬프트에 추가
  if (basePrompt && sourcePassage) {
    const mode = passageMode || "original";

    if (mode === "original") {
      basePrompt += `

[교과서 원본 지문 — 원문 그대로 활용]
아래 교과서 지문을 **그대로** 사용하여 문제를 출제하세요.
- 지문의 문장, 어휘, 구조를 변경하지 마세요.
- 지문 원문을 passage에 그대로 넣고, 해당 지문에서 문제를 출제하세요.
- 선지와 발문만 새로 작성하세요.

---
${sourcePassage}
---`;
    } else {
      basePrompt += `

[교과서 원본 지문 — 변형 활용]
아래 교과서 지문을 **변형**하여 문제를 출제하세요.
- 난이도에 따라 지문을 변형하세요:
  * 중 난이도: 지문의 일부 표현을 동의어로 교체하거나 문장 순서를 살짝 변경
  * 상 난이도: 지문의 핵심 단어를 학술적/고급 어휘로 교체하거나, 지문의 논지를 유지하면서 내용을 재구성
- 원본 지문의 주제와 핵심 논지는 유지하되, 학생이 단순 암기로 풀 수 없도록 변형하세요.

[원본 지문]
---
${sourcePassage}
---`;
    }
  }

  // 동일 지문 · 동일 유형으로 이미 출제된 형제 문제가 있을 경우, 발문/포커스를 다르게
  if (basePrompt && priorQuestions && priorQuestions.length > 0) {
    const list = priorQuestions
      .map((p, i) => `(${i + 1}) 발문: ${p.question}${p.answer ? `\n    정답: ${p.answer}` : ""}`)
      .join("\n");
    basePrompt += `

[이미 같은 지문·같은 유형으로 출제된 문제 — 중복 회피]
아래 ${priorQuestions.length}개 문제는 이미 출제됨. 새로 만드는 문제는 **반드시 다음 조건을 모두 충족**해야 한다:
1. 발문의 어휘·문장 구조를 직전 문제와 다르게 (단순히 어순만 바꾸지 말 것)
2. 묻는 초점·정답 후보의 위치·논리 측면을 다른 곳으로 이동 (예: 직전이 주제를 물었다면 이번엔 같은 유형 안에서도 다른 문장 또는 다른 지문 부분에 초점)
3. 정답으로 이끄는 단서 문장이 직전 문제와 겹치지 않게
4. 매력적 오답의 함정 기법도 직전과 다른 기법을 사용

이미 출제된 문제 목록:
${list}`;
  }

  return basePrompt;
}
