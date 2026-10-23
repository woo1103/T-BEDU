// 문제은행 → 학습지 변환에 쓰는 순수 함수들(서버·브라우저 공용)

const CIRCLES = ["①", "②", "③", "④", "⑤"];

// 문제 본문에 ①~⑤ 선지가 모두 있으면 5지선다 객관식
export function detectChoicesCount(problemLatex: string): number | null {
  return CIRCLES.every((c) => problemLatex.includes(c)) ? 5 : null;
}

// 본문에서 선지 내용 뽑기: "① $74$ ② 75 …" → ["74", "75", …] (수식 기호 $ 와 공백 제거)
export function parseChoiceTexts(problemLatex: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < CIRCLES.length; i++) {
    const start = problemLatex.indexOf(CIRCLES[i]);
    if (start < 0) return [];
    const nextIdx = i + 1 < CIRCLES.length ? problemLatex.indexOf(CIRCLES[i + 1], start + 1) : -1;
    const raw = problemLatex.slice(start + 1, nextIdx > start ? nextIdx : undefined).split("\n")[0];
    out.push(clean(raw));
  }
  return out;
}

function clean(s: string): string {
  return s.replace(/\$/g, "").replace(/\s+/g, "").replace(/[.。]$/, "");
}

/**
 * 선생님이 입력한 객관식 정답 → 원문자(학생 앱 선택값과 같은 형식이어야 채점됨).
 * "③"은 그대로, 1~5("3", "3번", "(3)")는 선지 번호로 본다. 그 밖의 값은 그대로.
 */
export function normalizeAnswer(answer: string, choicesCount: number | null): string {
  const a = answer.trim();
  if (choicesCount !== 5) return a;
  const circ = CIRCLES.find((c) => a.includes(c));
  if (circ) return circ;
  const m = a.match(/^\(?([1-5])\)?\s*번?$/);
  return m ? CIRCLES[Number(m[1]) - 1] : a;
}

/**
 * 문제은행에 '값'으로 저장된 예전 객관식 정답(예: "1"인데 ③의 내용이 1)을 선지 번호로.
 * 학습지 만들기 창을 열 때 미리 바꿔 보여 주고(선생님이 확인), 저장은 그 원문자로 한다.
 */
export function answerFromStoredValue(answer: string, choicesCount: number | null, problemLatex: string): string {
  const a = answer.trim();
  if (choicesCount !== 5 || CIRCLES.some((c) => a.includes(c))) return normalizeAnswer(a, choicesCount);
  const hit = parseChoiceTexts(problemLatex).findIndex((t) => t !== "" && t === clean(a));
  return hit >= 0 ? CIRCLES[hit] : normalizeAnswer(a, choicesCount);
}

// 인쇄용 본문: 그림을 따로 넣을 땐 본문의 "[그림]"/"[그림: …]" 자리 표시를 지운다
export function stripFigurePlaceholder(problemLatex: string): string {
  return problemLatex.replace(/\[그림(?::[^\]]*)?\]\s*/g, "").trim();
}
