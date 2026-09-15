// 영어 능력영역(초기 6종) + 문제 유형(questionType) → 능력영역 매핑.
// 태그 자동 배정과 시드에 사용. 태그 자체는 교사가 UI에서 추가/수정 가능(이 목록은 초기값).

export const ENGLISH_AREAS = [
  "어법",
  "어휘",
  "대의 파악",
  "세부 정보",
  "논리 추론",
  "글의 구조",
] as const;

export type EnglishArea = (typeof ENGLISH_AREAS)[number];

const TYPE_TO_AREA: Record<string, EnglishArea> = {
  // 어법
  "29_grammar": "어법",
  naesin_grammar: "어법",
  naesin_grammar_correct: "어법",
  // 어휘
  "30_vocabulary": "어휘",
  naesin_vocab: "어휘",
  // 대의 파악
  "18_purpose": "대의 파악",
  "20_claim": "대의 파악",
  "22_gist": "대의 파악",
  "23_topic": "대의 파악",
  "24_title": "대의 파악",
  naesin_topic: "대의 파악",
  // 세부 정보
  "25_chart": "세부 정보",
  "26_content_person": "세부 정보",
  "27_notice": "세부 정보",
  "28_notice2": "세부 정보",
  naesin_content: "세부 정보",
  // 논리 추론
  "19_mood": "논리 추론",
  "21_underline": "논리 추론",
  "31_blank_vocab": "논리 추론",
  "32_blank_sent": "논리 추론",
  "33_blank_sent2": "논리 추론",
  "34_blank_sent3": "논리 추론",
  naesin_blank_vocab: "논리 추론",
  naesin_blank_sent: "논리 추론",
  naesin_refer: "논리 추론",
  naesin_example: "논리 추론",
  // 글의 구조
  "35_irrelevant": "글의 구조",
  "36_order": "글의 구조",
  "37_order2": "글의 구조",
  "38_insertion": "글의 구조",
  "39_insertion2": "글의 구조",
  "40_summary": "글의 구조",
  naesin_order: "글의 구조",
  naesin_insertion: "글의 구조",
  "41_long_title": "글의 구조",
  "43_long_order": "글의 구조",
};

export function areaForQuestionType(questionType: string): EnglishArea | null {
  return TYPE_TO_AREA[questionType] ?? null;
}
