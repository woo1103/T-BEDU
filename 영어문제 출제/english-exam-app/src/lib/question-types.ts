export interface QuestionTypeInfo {
  code: string;
  number: number | string;
  name: string;
  nameEn: string;
  category: string;
  defaultPoints: number;
}

// 수능 영어 문항 유형 (18번~45번)
export const SUNEUNG_TYPES: QuestionTypeInfo[] = [
  { code: "18_purpose", number: 18, name: "목적 파악", nameEn: "Purpose", category: "듣기 후 독해", defaultPoints: 2 },
  { code: "19_mood", number: 19, name: "심경 변화", nameEn: "Mood Change", category: "추론", defaultPoints: 2 },
  { code: "20_claim", number: 20, name: "주장", nameEn: "Claim", category: "추론", defaultPoints: 2 },
  { code: "21_underline", number: 21, name: "밑줄 의미 추론", nameEn: "Underline Meaning", category: "추론", defaultPoints: 3 },
  { code: "22_gist", number: 22, name: "요지", nameEn: "Gist", category: "추론", defaultPoints: 2 },
  { code: "23_topic", number: 23, name: "주제", nameEn: "Topic", category: "추론", defaultPoints: 2 },
  { code: "24_title", number: 24, name: "제목 추론", nameEn: "Title", category: "추론", defaultPoints: 2 },
  { code: "25_chart", number: 25, name: "도표", nameEn: "Chart", category: "사실적 이해", defaultPoints: 2 },
  { code: "26_content_person", number: 26, name: "내용 일치(인물)", nameEn: "Content Match (Person)", category: "사실적 이해", defaultPoints: 2 },
  { code: "27_notice", number: 27, name: "안내문 일치", nameEn: "Notice Match", category: "사실적 이해", defaultPoints: 2 },
  { code: "28_notice2", number: 28, name: "안내문 일치", nameEn: "Notice Match 2", category: "사실적 이해", defaultPoints: 2 },
  { code: "29_grammar", number: 29, name: "어법", nameEn: "Grammar", category: "어법/어휘", defaultPoints: 3 },
  { code: "30_vocabulary", number: 30, name: "어휘", nameEn: "Vocabulary", category: "어법/어휘", defaultPoints: 2 },
  { code: "31_blank_vocab", number: 31, name: "빈칸(어휘)", nameEn: "Blank (Vocab)", category: "빈칸 추론", defaultPoints: 3 },
  { code: "32_blank_sent", number: 32, name: "빈칸(문장)", nameEn: "Blank (Sentence)", category: "빈칸 추론", defaultPoints: 3 },
  { code: "33_blank_sent2", number: 33, name: "빈칸(문장)", nameEn: "Blank (Sentence) 2", category: "빈칸 추론", defaultPoints: 3 },
  { code: "34_blank_sent3", number: 34, name: "빈칸(문장)", nameEn: "Blank (Sentence) 3", category: "빈칸 추론", defaultPoints: 2 },
  { code: "35_irrelevant", number: 35, name: "무관한 문장", nameEn: "Irrelevant Sentence", category: "글의 구조", defaultPoints: 2 },
  { code: "36_order", number: 36, name: "순서 배열", nameEn: "Sequence Order", category: "글의 구조", defaultPoints: 2 },
  { code: "37_order2", number: 37, name: "순서 배열", nameEn: "Sequence Order 2", category: "글의 구조", defaultPoints: 2 },
  { code: "38_insertion", number: 38, name: "문장 삽입", nameEn: "Sentence Insertion", category: "글의 구조", defaultPoints: 3 },
  { code: "39_insertion2", number: 39, name: "문장 삽입", nameEn: "Sentence Insertion 2", category: "글의 구조", defaultPoints: 2 },
  { code: "40_summary", number: 40, name: "요약문 완성", nameEn: "Summary Completion", category: "글의 구조", defaultPoints: 2 },
  { code: "41_long_title", number: "41-42", name: "장문(제목+어휘)", nameEn: "Long Passage (Title+Vocab)", category: "장문", defaultPoints: 2 },
  { code: "43_long_order", number: "43-45", name: "장문(순서+지칭+내용)", nameEn: "Long Passage (Order+Ref+Content)", category: "장문", defaultPoints: 2 },
];

// 내신 문제 유형
export const NAESIN_TYPES: QuestionTypeInfo[] = [
  { code: "naesin_vocab", number: 1, name: "어휘/숙어", nameEn: "Vocabulary/Idioms", category: "어휘", defaultPoints: 2 },
  { code: "naesin_grammar", number: 2, name: "어법(밑줄)", nameEn: "Grammar (Underline)", category: "문법", defaultPoints: 2 },
  { code: "naesin_grammar_correct", number: 3, name: "어법(어색한 것)", nameEn: "Grammar (Find Error)", category: "문법", defaultPoints: 2 },
  { code: "naesin_blank_vocab", number: 4, name: "빈칸(어휘)", nameEn: "Blank (Vocab)", category: "빈칸", defaultPoints: 2 },
  { code: "naesin_blank_sent", number: 5, name: "빈칸(문장)", nameEn: "Blank (Sentence)", category: "빈칸", defaultPoints: 3 },
  { code: "naesin_order", number: 6, name: "순서 배열", nameEn: "Sequence Order", category: "글의 구조", defaultPoints: 2 },
  { code: "naesin_insertion", number: 7, name: "문장 삽입", nameEn: "Sentence Insertion", category: "글의 구조", defaultPoints: 2 },
  { code: "naesin_topic", number: 8, name: "주제/요지/제목", nameEn: "Topic/Gist/Title", category: "독해", defaultPoints: 2 },
  { code: "naesin_content", number: 9, name: "내용 일치/불일치", nameEn: "Content Match", category: "독해", defaultPoints: 2 },
  { code: "naesin_refer", number: 10, name: "지칭 추론", nameEn: "Reference", category: "독해", defaultPoints: 2 },
  { code: "naesin_writing", number: 11, name: "서술형", nameEn: "Written Response", category: "서술형", defaultPoints: 5 },
];

// TOEIC 문제 유형
export const TOEIC_TYPES: QuestionTypeInfo[] = [
  { code: "toeic_part5", number: 5, name: "Part 5 (단문 빈칸)", nameEn: "Incomplete Sentences", category: "문법/어휘", defaultPoints: 1 },
  { code: "toeic_part6", number: 6, name: "Part 6 (장문 빈칸)", nameEn: "Text Completion", category: "독해", defaultPoints: 1 },
  { code: "toeic_part7_single", number: 7, name: "Part 7 (단일 지문)", nameEn: "Single Passage", category: "독해", defaultPoints: 1 },
  { code: "toeic_part7_double", number: 7, name: "Part 7 (이중 지문)", nameEn: "Double Passage", category: "독해", defaultPoints: 1 },
];

export const EXAM_TYPE_MAP = {
  suneung: { name: "수능/모의고사", types: SUNEUNG_TYPES },
  naesin: { name: "내신", types: NAESIN_TYPES },
  toeic: { name: "TOEIC", types: TOEIC_TYPES },
  toefl: { name: "TOEFL", types: [] as QuestionTypeInfo[] },
  custom: { name: "기타", types: [] as QuestionTypeInfo[] },
} as const;

export function getQuestionTypes(examType: string): QuestionTypeInfo[] {
  return EXAM_TYPE_MAP[examType as keyof typeof EXAM_TYPE_MAP]?.types || [];
}

export function getQuestionTypeInfo(examType: string, questionType: string): QuestionTypeInfo | undefined {
  const types = getQuestionTypes(examType);
  return types.find((t) => t.code === questionType);
}

export const DIFFICULTY_MAP = {
  easy: { name: "하", color: "text-green-600 bg-green-50" },
  medium: { name: "중", color: "text-yellow-600 bg-yellow-50" },
  hard: { name: "상", color: "text-red-600 bg-red-50" },
} as const;
