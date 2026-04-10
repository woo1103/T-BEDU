import { getSuneungPrompt, getSuneungDifficulty } from "./suneung";
import { getNaesinPrompt } from "./naesin";

export function getSystemPrompt(
  examType: string,
  questionType: string,
  difficulty: string,
  sourcePassage?: string,
  passageMode?: string
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

  return basePrompt;
}
