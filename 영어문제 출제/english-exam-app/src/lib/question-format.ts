// 유형별 선지 정규화 + 검증
// - 선지 라벨(①②③④⑤)은 저장/표시 단계에서 "배열 순서"로 부여되므로,
//   여기서는 (a) 선지 text에 섞여 들어온 마커를 제거해 라벨과의 이중표기/불일치를 없애고,
//   (b) 유형별 기대 선지 개수·정답 개수·지문 마커 정합성을 검증한다.

export type TextKind = "expression" | "marker" | "text";

interface FormatConfig {
  choiceCount: number;
  textKind: TextKind;
}

// ①(U+2460) ~ ⑩(U+2469)
const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

// 유형별 형식. 지정되지 않은 유형은 5지선다 일반형(default).
const FORMAT: Record<string, FormatConfig> = {
  // 오류 찾기(어법/어휘): 선지 text = 밑줄 표현, 지문에 ①~⑤ 마커
  "29_grammar": { choiceCount: 5, textKind: "expression" },
  "30_vocabulary": { choiceCount: 5, textKind: "expression" },
  naesin_grammar_correct: { choiceCount: 5, textKind: "expression" },
  // 위치 선택(무관한 문장): 선지 = 위치 번호, 지문에 ①~⑤ 마커
  "35_irrelevant": { choiceCount: 5, textKind: "marker" },
  // 문장 삽입: 4자리(①~④), 선지 = 위치 번호
  "38_insertion": { choiceCount: 4, textKind: "marker" },
  "39_insertion2": { choiceCount: 4, textKind: "marker" },
  naesin_insertion: { choiceCount: 4, textKind: "marker" },
};

// 객관식이 아니라 검증에서 제외할 유형 (서술형 등)
const SKIP_VALIDATION = new Set<string>(["naesin_writing"]);

const DEFAULT_FORMAT: FormatConfig = { choiceCount: 5, textKind: "text" };

export function getFormat(questionType: string): FormatConfig {
  return FORMAT[questionType] || DEFAULT_FORMAT;
}

// 선지 text 앞에 붙은 라벨 마커(①~⑩, (A)~(E)/(a)~(e), A./A)/1./1))를 제거
const LEADING_MARKER = /^\s*(?:[①-⑩]|\([A-Ea-e]\)|[A-Ea-e][.)]|[1-9][.)])\s*/;

export function stripLeadingMarker(text: string): string {
  return text.replace(LEADING_MARKER, "").trim();
}

export interface RawChoice {
  text: string;
  isCorrect: boolean;
}

export function normalizeChoices(
  questionType: string,
  choices: unknown
): RawChoice[] {
  if (!Array.isArray(choices)) return [];
  const { textKind } = getFormat(questionType);

  return choices.map((c) => {
    const isCorrect = (c as RawChoice)?.isCorrect === true;
    let text =
      typeof (c as RawChoice)?.text === "string" ? (c as RawChoice).text : "";

    if (textKind === "expression") {
      // 밑줄 표현만 남긴다 (앞에 붙은 번호 제거)
      text = stripLeadingMarker(text);
    } else if (textKind === "marker") {
      // 위치 선지는 라벨이 번호를 담당하므로 text는 비운다
      text = "";
    }

    return { text, isCorrect };
  });
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateQuestion(
  questionType: string,
  passage: string,
  choices: RawChoice[]
): ValidationResult {
  const errors: string[] = [];

  if (SKIP_VALIDATION.has(questionType)) {
    return { ok: true, errors };
  }

  const { choiceCount, textKind } = getFormat(questionType);

  if (choices.length !== choiceCount) {
    errors.push(`선지 개수 ${choices.length}개 (기대 ${choiceCount}개)`);
  }

  const correctCount = choices.filter((c) => c.isCorrect === true).length;
  if (correctCount !== 1) {
    errors.push(`정답 표시 ${correctCount}개 (정확히 1개여야 함)`);
  }

  // 마커 기반 유형: 지문에 ①..(개수) 마커가 모두 있어야 라벨과 위치가 맞는다
  if (textKind === "expression" || textKind === "marker") {
    const p = passage || "";
    const missing = CIRCLED.slice(0, choiceCount).filter(
      (m) => !p.includes(m)
    );
    if (missing.length > 0) {
      errors.push(`지문에 마커 누락: ${missing.join("")}`);
    }
  }

  // 표현형(어법/어휘): 밑줄 표현이 비어 있으면 안 됨
  if (textKind === "expression") {
    if (choices.some((c) => !c.text || c.text.trim() === "")) {
      errors.push("선지의 밑줄 표현이 비어 있음");
    }
  }

  return { ok: errors.length === 0, errors };
}
