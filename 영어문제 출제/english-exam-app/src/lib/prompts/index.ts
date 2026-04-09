import { getSuneungPrompt, getSuneungDifficulty } from "./suneung";
import { getNaesinPrompt } from "./naesin";

export function getSystemPrompt(
  examType: string,
  questionType: string,
  difficulty: string,
  sourcePassage?: string
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
    basePrompt += `

[교과서 원본 지문]
아래 지문을 기반으로 문제를 출제하세요. 지문의 내용, 어휘, 구문을 활용하여 문제를 만드세요.
원본 지문을 그대로 사용하거나, 일부를 변형하여 출제할 수 있습니다.

---
${sourcePassage}
---`;
  }

  return basePrompt;
}
