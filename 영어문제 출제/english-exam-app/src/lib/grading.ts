// 채점 기준 정규화 유틸.
// 핵심: 객관식은 "문제지의 정답 선지(isCorrect)"를 정답의 근거로 삼고,
// 라벨 형식(①/1/1)/(1)/1. 등) 차이를 정규화해 "맞았는데 틀리는" 오류를 없앤다.

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

// 정답/선택값 정규화: 원문자→숫자, "3)"·"(3)"·"3." → "3", 공백 정리, 소문자화
export function normalizeAnswer(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (s === "") return "";
  const ci = CIRCLED.indexOf(s);
  if (ci >= 0) return String(ci + 1);
  const m = s.match(/^\(?\s*(\d{1,2})\s*[).．。]?\)?$/);
  if (m) return m[1];
  return s.replace(/\s+/g, " ").toLowerCase();
}

// 문항의 정답 라벨을 구한다.
// 객관식: choices의 isCorrect 선지(=문제지에 표시된 정답)를 최우선으로 사용.
//         (answer 필드가 다른 형식으로 저장돼 있어도 문제지를 기준으로 채점)
// 선지가 없거나(서술형) isCorrect 미표기면 answer 필드로 폴백.
export function correctLabel(question: {
  answer: string;
  choices: string;
}): string | null {
  try {
    const parsed = JSON.parse(question.choices) as {
      label: string;
      isCorrect: boolean;
    }[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const c = parsed.find((x) => x.isCorrect);
      if (c?.label) return c.label;
    }
  } catch {
    /* ignore */
  }
  return question.answer && question.answer.trim() ? question.answer.trim() : null;
}

// 학생 답이 정답인지 판정(정규화 비교). 빈 답은 항상 오답.
export function isAnswerCorrect(
  selected: string,
  correct: string | null
): boolean {
  if (correct == null) return false;
  const s = normalizeAnswer(selected);
  const c = normalizeAnswer(correct);
  return s !== "" && s === c;
}
