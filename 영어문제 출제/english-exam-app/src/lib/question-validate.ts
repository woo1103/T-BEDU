// 문항 구조 검증: 어법/어휘·순서배열·문장삽입처럼 "지문 마커 ↔ 선지"가
// 대응하는 유형에서 마커 수·선지 수·정답 범위가 어긋난 "깨진 문제"를 잡아낸다.
// - 생성 시: 깨진 결과를 폐기/재생성하는 가드
// - 정리 시: 기존 DB의 깨진 문제를 감지해 삭제

export const GRAMMAR_VOCAB_TYPES = [
  "29_grammar",
  "30_vocabulary",
  "naesin_grammar",
  "naesin_grammar_correct",
  "naesin_vocab",
];
export const ORDER_TYPES = ["36_order", "37_order2", "43_long_order", "naesin_order"];
export const INSERTION_TYPES = ["38_insertion", "39_insertion2", "naesin_insertion"];

// 선지 라벨이 지문 마커(①~⑤)와 대응하는 유형(선지 재배치 금지 대상)
export function isMarkerMappedType(questionType: string): boolean {
  return (
    GRAMMAR_VOCAB_TYPES.includes(questionType) ||
    ORDER_TYPES.includes(questionType) ||
    INSERTION_TYPES.includes(questionType)
  );
}

const CIRCLE = ["①", "②", "③", "④", "⑤"];

export interface ValChoice {
  label?: string;
  text?: string;
  isCorrect?: boolean;
}

function correctFrom(choices: ValChoice[], answer?: string): string {
  const a = (answer ?? "").trim();
  if (a) return a;
  return (choices.find((c) => c.isCorrect)?.label ?? "").trim();
}

// ok=false면 구조가 깨진 문제. reason에 사유.
export function validateQuestionStructure(
  questionType: string,
  passage: string,
  choices: ValChoice[],
  answer?: string
): { ok: boolean; reason?: string } {
  const p = passage || "";
  const correct = correctFrom(choices, answer);

  if (GRAMMAR_VOCAB_TYPES.includes(questionType)) {
    if (choices.length !== 5)
      return { ok: false, reason: `선지 ${choices.length}개(5개 필요)` };
    for (const m of CIRCLE) {
      if (!p.includes(m))
        return { ok: false, reason: `지문에 ${m} 밑줄 마커 없음` };
    }
    if (correct && !CIRCLE.includes(correct))
      return { ok: false, reason: `정답 라벨(${correct}) 비정상` };
    if (correct && !p.includes(correct))
      return { ok: false, reason: `정답(${correct})이 지문에 밑줄로 없음` };
    return { ok: true };
  }

  if (ORDER_TYPES.includes(questionType)) {
    if (choices.length !== 5)
      return { ok: false, reason: `선지 ${choices.length}개(5개 필요)` };
    if (!(p.includes("(A)") && p.includes("(B)") && p.includes("(C)")))
      return { ok: false, reason: "(A)(B)(C) 단락 누락" };
    return { ok: true };
  }

  if (INSERTION_TYPES.includes(questionType)) {
    if (choices.length !== 5)
      return { ok: false, reason: `선지 ${choices.length}개(5개 필요)` };
    const markerCount = CIRCLE.filter((m) => p.includes(m)).length;
    // 본문 삽입 위치 마커는 최소 4개(⑤는 렌더러가 보강 가능)
    if (markerCount < 4)
      return { ok: false, reason: `삽입 위치 마커 ${markerCount}개(4~5 필요)` };
    return { ok: true };
  }

  return { ok: true }; // 그 외 유형은 검증 대상 아님
}

// DB의 Question 행(choices는 JSON 문자열)에 대한 검증
export function validateStoredQuestion(q: {
  questionType: string;
  passage: string;
  choices: string;
  answer: string;
}): { ok: boolean; reason?: string } {
  if (!isMarkerMappedType(q.questionType)) return { ok: true };
  let parsed: ValChoice[] = [];
  try {
    parsed = JSON.parse(q.choices) as ValChoice[];
  } catch {
    return { ok: false, reason: "선지 JSON 파싱 불가" };
  }
  return validateQuestionStructure(q.questionType, q.passage, parsed, q.answer);
}
