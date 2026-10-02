import { getSuneungPrompt, getSuneungDifficulty } from "./suneung";
import { getNaesinPrompt } from "./naesin";
import { buildVariationBlock } from "../variations";

export function getSystemPrompt(
  examType: string,
  questionType: string,
  difficulty: string,
  sourcePassage?: string,
  passageMode?: string,
  priorQuestions?: { question: string; answer?: string }[],
  variations?: string[]
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

[이미 출제된 같은 유형 문제 — 번호마다 완전히 다르게]
아래 ${priorQuestions.length}개 문제는 이미 출제됨. 새로 만드는 문제는 **반드시 다음을 모두 충족**해야 한다:
1. **소재(subject matter)를 완전히 다른 분야로** 바꾼다. (예: 직전이 환경이면 이번엔 심리/역사/과학/예술/경제 등 전혀 다른 소재 — 같은 소재 금지)
2. **글의 구성·전개 방식을 다르게** 한다. (예: 주장-근거형 ↔ 비교대조형 ↔ 시간순 서술 ↔ 통념반박형 ↔ 예시나열형 중 직전과 다른 전개)
3. **주제·논지**가 직전 문제들과 겹치지 않게 한다.
4. 발문의 어휘·문장 구조를 직전과 다르게 (단순 어순 변경 금지).
5. 정답 단서 문장의 위치·매력적 오답의 함정 기법도 직전과 다르게.
${sourcePassage ? "" : "※ 지문을 새로 생성하는 경우, 지문 자체의 소재·배경·전개가 직전 문제들과 명확히 달라야 한다."}

이미 출제된 문제 목록(소재가 겹치면 안 됨):
${list}`;
  }

  // 고난도 변형 갈래(선택) 주입
  if (basePrompt) {
    basePrompt += buildVariationBlock(variations);
  }

  return basePrompt;
}
