/**
 * 지문(passage) 파싱 모듈
 * questionType에 따라 구조화된 객체로 변환
 */

export interface OrderParsed {
  type: "order";
  givenParagraph: string;
  segments: { label: string; text: string }[];
}

export interface InsertionParsed {
  type: "insertion";
  givenSentence: string;
  bodyParts: { text: string; marker?: string }[];
}

export interface GrammarParsed {
  type: "grammar";
  parts: { text: string; underlined?: string; marker?: string }[];
}

export interface SummaryParsed {
  type: "summary";
  mainPassage: string;
  summaryText: string;
}

export interface WritingParsed {
  type: "writing";
  passage: string;
}

export interface DefaultParsed {
  type: "default";
  text: string;
}

export type ParsedPassage =
  | DefaultParsed
  | OrderParsed
  | InsertionParsed
  | GrammarParsed
  | SummaryParsed
  | WritingParsed;

// 순서배열 코드
const ORDER_TYPES = ["36_order", "37_order2", "43_long_order", "naesin_order"];
// 문장삽입 코드
const INSERTION_TYPES = ["38_insertion", "39_insertion2", "naesin_insertion"];
// 어법/어휘 코드
const GRAMMAR_VOCAB_TYPES = [
  "29_grammar",
  "30_vocabulary",
  "naesin_grammar",
  "naesin_grammar_correct",
  "naesin_vocab",
];
// 요약문 코드
const SUMMARY_TYPES = ["40_summary", "naesin_summary"];
// 서술형 코드
const WRITING_TYPES = [
  "naesin_writing",
  "naesin_writing_summary",
  "naesin_writing_grammar",
  "naesin_writing_vocab",
  "naesin_writing_composition",
];

const CIRCLE_MARKERS = ["①", "②", "③", "④", "⑤"];

export interface MarkerChoice {
  label: string;
  text: string;
  isCorrect: boolean;
}

// 선지가 ①~⑤ 마커만으로 구성됐는지 판별
// "문장 끝" 같은 꾸밈말은 무시하고 판정한다.
export function isMarkerOnlyChoices(choices: MarkerChoice[]): boolean {
  if (choices.length === 0) return false;
  return choices.every((c) => {
    const stripped = (c.text ?? "").replace(/[()\s]*문장\s*끝[()\s]*/g, "").trim();
    return CIRCLE_MARKERS.includes(stripped);
  });
}

// 마커-only 선지만 ①→⑤ 순서로 정렬하고 "문장 끝" 등의 꾸밈말을 제거한다.
// 영어/한글이 섞인 선지(요약문·어법 해설·서술형 등)는 건드리지 않는다.
export function normalizeMarkerChoices<T extends MarkerChoice>(choices: T[]): T[] {
  if (!isMarkerOnlyChoices(choices)) return choices;
  return choices
    .map((c) => ({
      ...c,
      text: (c.text ?? "").replace(/[()\s]*문장\s*끝[()\s]*/g, "").trim(),
    }))
    .sort(
      (a, b) =>
        CIRCLE_MARKERS.indexOf(a.text) - CIRCLE_MARKERS.indexOf(b.text)
    )
    .map((c, i) => ({ ...c, label: CIRCLE_MARKERS[i] }));
}

export function parsePassage(
  passage: string,
  questionType: string
): ParsedPassage {
  if (!passage) return { type: "default", text: "" };

  // <u>...</u> → __...__ 로 정규화 (기존 AI 생성 데이터 호환)
  const normalized = normalizeUnderlineTags(passage);

  if (ORDER_TYPES.includes(questionType)) {
    return parseOrder(normalized);
  }
  if (INSERTION_TYPES.includes(questionType)) {
    return parseInsertion(normalized);
  }
  if (GRAMMAR_VOCAB_TYPES.includes(questionType)) {
    return parseGrammar(normalized);
  }
  if (SUMMARY_TYPES.includes(questionType)) {
    return parseSummary(normalized);
  }
  if (WRITING_TYPES.includes(questionType)) {
    return { type: "writing", passage: normalized };
  }

  return { type: "default", text: normalized };
}

// <u>text</u> 또는 <U>text</U> 를 __text__ 로 변환
export function normalizeUnderlineTags(passage: string): string {
  return passage.replace(/<\/?u>/gi, "__").replace(/____/g, "");
}

// __text__ 마커를 분할하여 underline 여부와 함께 반환
export interface InlineSegment {
  text: string;
  underline: boolean;
}

export function splitInlineUnderline(text: string): InlineSegment[] {
  if (!text) return [];
  const result: InlineSegment[] = [];
  const regex = /__([\s\S]+?)__/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      result.push({ text: text.substring(lastIdx, match.index), underline: false });
    }
    result.push({ text: match[1], underline: true });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    result.push({ text: text.substring(lastIdx), underline: false });
  }
  return result.length === 0 ? [{ text, underline: false }] : result;
}

function parseOrder(passage: string): OrderParsed | DefaultParsed {
  // 형식: [주어진 글] ... (A) ... (B) ... (C) ...
  // 또는 마커 없이 바로 시작 후 (A)(B)(C)
  let givenParagraph = "";
  let rest = passage;

  // [주어진 글] 마커 제거 및 추출
  const givenMatch = passage.match(
    /\[주어진 글\]\s*([\s\S]*?)(?=\(A\))/i
  );
  if (givenMatch) {
    givenParagraph = givenMatch[1].trim();
    rest = passage.substring(passage.indexOf("(A)"));
  } else {
    // 마커 없이 (A) 앞의 텍스트를 주어진 글로 간주
    const aIdx = passage.indexOf("(A)");
    if (aIdx === -1) return { type: "default", text: passage };
    givenParagraph = passage.substring(0, aIdx).trim();
    rest = passage.substring(aIdx);
  }

  // (A), (B), (C) 세그먼트 추출
  const segmentRegex = /\(([A-C])\)\s*([\s\S]*?)(?=\([A-C]\)|$)/g;
  const segments: { label: string; text: string }[] = [];
  let match;
  while ((match = segmentRegex.exec(rest)) !== null) {
    segments.push({
      label: `(${match[1]})`,
      text: match[2].trim(),
    });
  }

  if (segments.length === 0) return { type: "default", text: passage };

  return { type: "order", givenParagraph, segments };
}

function parseInsertion(passage: string): InsertionParsed | DefaultParsed {
  // 형식: [주어진 문장] ...\n\n[본문] ... ① ... ② ... ③ ... ④ ...
  let givenSentence = "";
  let body = "";

  const sentenceMatch = passage.match(
    /\[주어진 문장\]\s*([\s\S]*?)(?:\n\n\[본문\]|\n\n)/
  );
  if (sentenceMatch) {
    givenSentence = sentenceMatch[1].trim();
    const bodyMatch = passage.match(/\[본문\]\s*([\s\S]*)/);
    if (bodyMatch) {
      body = bodyMatch[1].trim();
    } else {
      // [본문] 마커 없이 \n\n 이후
      const idx = passage.indexOf(sentenceMatch[0]) + sentenceMatch[0].length;
      body = passage.substring(idx).trim();
    }
  } else {
    // 마커 없을 경우 첫 번째 ① 이전을 주어진 문장으로, 이후를 본문으로
    const firstMarkerIdx = findFirstCircleMarker(passage);
    if (firstMarkerIdx === -1) return { type: "default", text: passage };

    // \n\n으로 구분 시도
    const doubleNewline = passage.indexOf("\n\n");
    if (doubleNewline !== -1 && doubleNewline < firstMarkerIdx) {
      givenSentence = passage.substring(0, doubleNewline).trim();
      body = passage.substring(doubleNewline + 2).trim();
    } else {
      givenSentence = passage.substring(0, firstMarkerIdx).trim();
      body = passage.substring(firstMarkerIdx).trim();
    }
  }

  if (!givenSentence) return { type: "default", text: passage };

  // 본문을 ①②③④⑤ 마커로 분리
  const bodyParts = splitByCircleMarkers(body);

  // 문장삽입 본문에는 반드시 ⑤ 마커(마지막 위치)가 있어야 함.
  // 원본 데이터가 ①~④까지만 있을 경우 맨 끝에 ⑤를 보강한다.
  const hasFifth = bodyParts.some((p) => p.marker === "⑤");
  const hasAnyMarker = bodyParts.some((p) => !!p.marker);
  if (hasAnyMarker && !hasFifth) {
    bodyParts.push({ text: "", marker: "⑤" });
  }

  return { type: "insertion", givenSentence, bodyParts };
}

function parseGrammar(passage: string): GrammarParsed | DefaultParsed {
  // 어법/어휘: 지문에 ①word ②word 등의 마커+밑줄 단어가 포함
  // 패턴: ①underlined_word 또는 ① underlined_word
  const parts: GrammarParsed["parts"] = [];

  // ①~⑤ 마커로 분리
  const markerPattern = /([①②③④⑤])\s*/g;
  let lastIdx = 0;
  let match;
  const markers: { marker: string; idx: number }[] = [];

  while ((match = markerPattern.exec(passage)) !== null) {
    markers.push({ marker: match[1], idx: match.index });
  }

  if (markers.length === 0) return { type: "default", text: passage };

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    // 마커 이전 일반 텍스트
    if (m.idx > lastIdx) {
      const text = passage.substring(lastIdx, m.idx);
      if (text.trim()) parts.push({ text });
    }

    // 마커 다음 단어(밑줄 대상) 추출
    const afterMarker = passage.substring(
      m.idx + m.marker.length
    );
    // 다음 마커 또는 문장 끝까지에서 첫 단어/구를 밑줄 대상으로
    const nextMarkerIdx =
      i + 1 < markers.length
        ? markers[i + 1].idx - m.idx - m.marker.length
        : afterMarker.length;
    const segment = afterMarker.substring(0, nextMarkerIdx);

    // 밑줄 단어: 마커 바로 뒤의 단어 또는 구 (공백/구두점 전까지)
    // 다양한 형식 지원: ①word, ① word, ①__word__, ① word rest of text
    const wordMatch = segment.match(
      /^\s*(?:__)?(\S+?)(?:__)?(?=[\s,.\-;:!?'")\]]|$)/
    );
    if (wordMatch) {
      const underlined = wordMatch[1];
      const restText = segment.substring(wordMatch[0].length);
      parts.push({ text: "", underlined, marker: m.marker });
      if (restText.trim()) parts.push({ text: restText });
    } else {
      parts.push({ text: segment, marker: m.marker });
    }

    lastIdx = m.idx + m.marker.length + nextMarkerIdx;
  }

  // 남은 텍스트
  if (lastIdx < passage.length) {
    const remaining = passage.substring(lastIdx);
    if (remaining.trim()) parts.push({ text: remaining });
  }

  return { type: "grammar", parts };
}

function parseSummary(passage: string): SummaryParsed | DefaultParsed {
  // 형식: [본문] ...\n\n[요약문] ...
  const bodyMatch = passage.match(
    /\[본문\]\s*([\s\S]*?)(?=\n\n\[요약문\])/
  );
  const summaryMatch = passage.match(/\[요약문\]\s*([\s\S]*)/);

  if (bodyMatch && summaryMatch) {
    return {
      type: "summary",
      mainPassage: bodyMatch[1].trim(),
      summaryText: summaryMatch[1].trim(),
    };
  }

  // 마커 없이 \n\n으로 구분 시도 (마지막 단락을 요약문으로)
  const sections = passage.split(/\n\n+/);
  if (sections.length >= 2) {
    const summaryText = sections[sections.length - 1].trim();
    const mainPassage = sections.slice(0, -1).join("\n\n").trim();
    // 요약문에 (A), (B) 빈칸이 있으면 요약문으로 판단
    if (summaryText.includes("(A)") && summaryText.includes("(B)")) {
      return { type: "summary", mainPassage, summaryText };
    }
  }

  return { type: "default", text: passage };
}

// 헬퍼: 첫 번째 원문자 마커 위치 찾기
function findFirstCircleMarker(text: string): number {
  let minIdx = -1;
  for (const marker of CIRCLE_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx !== -1 && (minIdx === -1 || idx < minIdx)) {
      minIdx = idx;
    }
  }
  return minIdx;
}

// 헬퍼: 원문자 마커로 텍스트 분리
function splitByCircleMarkers(
  text: string
): { text: string; marker?: string }[] {
  const parts: { text: string; marker?: string }[] = [];
  const markerPattern = /([①②③④⑤])/g;
  let lastIdx = 0;
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const before = text.substring(lastIdx, match.index).trim();
      if (before) parts.push({ text: before });
    }
    parts.push({ text: "", marker: match[1] });
    lastIdx = match.index + match[1].length;
  }

  if (lastIdx < text.length) {
    const remaining = text.substring(lastIdx).trim();
    if (remaining) parts.push({ text: remaining });
  }

  return parts;
}

// questionType이 서술형인지 판별
export function isWritingType(questionType: string): boolean {
  return WRITING_TYPES.includes(questionType);
}

// questionType이 요약문인지 판별
export function isSummaryType(questionType: string): boolean {
  return SUMMARY_TYPES.includes(questionType);
}
