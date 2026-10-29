"use client";

/**
 * 모의고사(학력평가·모의평가) 양식 시험지 PDF.
 * 교시 박스 + "영어 영역" 머리, 홀짝 쪽 머리, n/전체 쪽수, 2단(가운데 세로선),
 * 박스 없는 양쪽 정렬 지문, 각주, 길이에 맞춘 선지 배치, [n~m] 묶음 머리, 듣기 안내 박스.
 * 레이아웃 형식만 따르며 기관 문구·저작권 표시는 넣지 않는다.
 */

import type { ComponentProps, ReactNode } from "react";
import { Document, Page, Text, View, Svg, Line, Font, StyleSheet } from "@react-pdf/renderer";
import {
  parsePassage,
  isWritingType,
  normalizeUnderlineTags,
  splitInlineUnderline,
  normalizeMarkerChoices,
  isMarkerOnlyChoices,
} from "@/lib/passage-parser";
import { BLANK_TOKEN, SERIF_METRICS, countLines, packColumns, textWidth } from "@/lib/pdf-layout";

// 브라우저에선 /fonts URL, 테스트(Node)에선 디스크 경로
const FONT_BASE = typeof window === "undefined" ? `${process.cwd()}/public/fonts` : "/fonts";
Font.register({
  family: "NotoSerifKR",
  fonts: [
    { src: `${FONT_BASE}/NotoSerifKR-Regular.otf`, fontWeight: 400 },
    { src: `${FONT_BASE}/NotoSerifKR-Bold.otf`, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

// 스타일 경계에서 하이픈 줄바꿈 금지 (ExamPDF와 동일한 이유)
const NO_HYPHEN_BREAK = { hyphenationPenalty: 10000 } as object;
function T(props: ComponentProps<typeof Text>) {
  return <Text {...NO_HYPHEN_BREAK} {...props} />;
}

const CIRCLE = ["①", "②", "③", "④", "⑤"];
const BLANK_TEXT = "_".repeat(18);
const RED = "#C62828";

export interface MockExamItem {
  orderNum: number;
  customPoints: number | null;
  question: {
    passage: string;
    question: string;
    choices: string;
    answer: string;
    points: number;
    questionType: string;
    explanation?: string | null;
  };
}

export interface MockExamOptions {
  examName: string; // 예: "2026학년도 10월 고1 모의고사 문제지"
  period: string; // 예: "제 3 교시"
  subject: string; // 예: "영어 영역"
  grade: string; // 예: "고1"
  includeListening: boolean; // 듣기 안내 박스 + 독해 18번부터
}

export interface MockExamPDFProps {
  items: MockExamItem[];
  options: MockExamOptions;
  mode?: "student" | "teacher";
  showAnswers?: boolean;
  // 검사용: true면 단 페이지도 넘칠 때 쪽을 늘려(잘라내지 않고) 넘침이 쪽 수로 드러나게 한다
  revealOverflow?: boolean;
}

// ── 치수 (높이 계산과 스타일이 공유) ──
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const PAD_X = 46;
const PAD_TOP = 36;
const PAD_BOTTOM = 52; // 쪽수 박스 자리 포함
const FIRST_HEADER_H = 96;
const HEADER_H = 50;
const GUTTER = 22; // 단 사이(가운데 세로선 포함)
const COL_W = (PAGE_W - PAD_X * 2 - GUTTER) / 2;
const COLUMNS_PAD_TOP = 10;
const SAFETY = 14; // 추정 오차 여유
const colHeightFor = (pageIndex: number) =>
  PAGE_H - PAD_TOP - PAD_BOTTOM - (pageIndex === 0 ? FIRST_HEADER_H : HEADER_H) - COLUMNS_PAD_TOP - SAFETY;
const ITEM_GAP = 16;

const NUM_W = 20; // 문항 번호 칸
const Q_FS = 10;
const Q_LH = Q_FS * 1.45;
const P_FS = 9.8;
const P_LH = P_FS * 1.55;
const P_INDENT = P_FS;
const INSET = 6; // 지문·선지 들여쓰기
const C_FS = 9.6;
const C_LH = C_FS * 1.45;
const C_GAP = 1.5;
const FN_FS = 7.5;
const FN_LH = FN_FS * 1.3;
const BOX_PAD_X = 8;
const BOX_PAD_Y = 6;
const BOX_BORDER = 0.8;
const BLANK_W = textWidth(BLANK_TEXT, P_FS, false, SERIF_METRICS);

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSerifKR",
    paddingTop: PAD_TOP,
    paddingBottom: PAD_BOTTOM,
    paddingHorizontal: PAD_X,
    color: "#111111",
  },
  // 첫 쪽 머리
  firstHeader: { height: FIRST_HEADER_H },
  examNameRow: { flexDirection: "row", alignItems: "flex-end", height: 30 },
  examName: { flex: 1, textAlign: "center", fontSize: 15 },
  bigPageNo: { fontSize: 24, width: 40, textAlign: "right" },
  titleRow: { flexDirection: "row", alignItems: "center", height: 52 },
  periodBox: {
    borderWidth: BOX_BORDER,
    borderColor: "#111111",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  periodText: { fontSize: 13 },
  bigTitle: { fontSize: 30, fontWeight: 700, textAlign: "center", flex: 1 },
  ruleThick: { borderBottomWidth: 1.6, borderBottomColor: "#111111" },
  // 이후 쪽 머리
  header: { height: HEADER_H },
  headerRow: { flexDirection: "row", alignItems: "center", height: 40 },
  headerTitle: { fontSize: 20, fontWeight: 700, textAlign: "center", flex: 1 },
  pageNo: { fontSize: 22, width: 70 },
  gradeBox: {
    width: 70,
    borderWidth: BOX_BORDER,
    borderColor: "#111111",
    borderRadius: 12,
    paddingVertical: 2,
  },
  gradeText: { fontSize: 13, fontWeight: 700, textAlign: "center" },
  // 본문 단
  columns: { flexDirection: "row", flex: 1, paddingTop: COLUMNS_PAD_TOP },
  column: { width: COL_W },
  divider: { width: GUTTER, alignItems: "center" },
  dividerLine: { width: 0.8, flex: 1, backgroundColor: "#111111" },
  // 문항
  qRow: { flexDirection: "row", marginBottom: 6 },
  qNum: { width: NUM_W, fontSize: 11, fontWeight: 700 },
  qText: { flex: 1, fontSize: Q_FS, lineHeight: 1.45 },
  groupHead: { fontSize: 10.5, fontWeight: 700, lineHeight: 1.45, marginBottom: 6 },
  passage: {
    fontSize: P_FS,
    lineHeight: 1.55,
    textAlign: "justify",
    textIndent: P_INDENT,
    paddingLeft: INSET,
    marginBottom: 6,
  },
  footnote: { fontSize: FN_FS, lineHeight: 1.3, textAlign: "right", marginBottom: 4 },
  box: {
    borderWidth: BOX_BORDER,
    borderColor: "#111111",
    paddingHorizontal: BOX_PAD_X,
    paddingVertical: BOX_PAD_Y,
    marginLeft: INSET,
    marginBottom: 6,
  },
  boxText: { fontSize: P_FS, lineHeight: 1.55, textAlign: "justify", textIndent: P_INDENT },
  segRow: { flexDirection: "row", paddingLeft: INSET, marginBottom: 3 },
  segLabel: { width: 22, fontSize: P_FS, lineHeight: 1.55 },
  segText: { flex: 1, fontSize: P_FS, lineHeight: 1.55, textAlign: "justify" },
  arrow: { textAlign: "center", fontSize: 12, height: 18 },
  choicesWrap: { paddingLeft: INSET },
  choiceRow: { flexDirection: "row", marginBottom: C_GAP },
  choiceCell: { flexDirection: "row" },
  choiceLabel: { width: 14, fontSize: C_FS, lineHeight: 1.45 },
  choiceText: { flex: 1, fontSize: C_FS, lineHeight: 1.45 },
  answerArea: {
    borderWidth: BOX_BORDER,
    borderColor: "#999999",
    borderStyle: "dashed",
    height: 60,
    marginLeft: INSET,
    marginBottom: 6,
  },
  noticeBox: {
    borderWidth: BOX_BORDER,
    borderColor: "#111111",
    paddingHorizontal: BOX_PAD_X,
    paddingVertical: BOX_PAD_Y,
  },
  noticeText: { fontSize: P_FS, lineHeight: 1.5, textAlign: "justify", textIndent: P_INDENT },
  // 쪽수
  footer: { position: "absolute", bottom: 20, left: 0, right: 0, alignItems: "center" },
  slashBox: { width: 52, height: 20, borderWidth: BOX_BORDER, borderColor: "#111111", position: "relative" },
  slashNo: { position: "absolute", top: 1, left: 6, fontSize: 11, fontWeight: 700 },
  slashTotal: { position: "absolute", bottom: 0, right: 6, fontSize: 11, fontWeight: 700 },
  // 정답표
  answerTitle: { fontSize: 14, fontWeight: 700, textAlign: "center", marginVertical: 14 },
  answerGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  answerCell: { width: 56, flexDirection: "row", borderWidth: 0.6, borderColor: "#777777", margin: 2 },
  answerNum: { width: 24, fontSize: 9, textAlign: "center", backgroundColor: "#EEEEEE", paddingVertical: 3 },
  answerVal: { flex: 1, fontSize: 10, textAlign: "center", paddingVertical: 2, color: RED, fontWeight: 700 },
  // 해설
  explainTitle: { fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 18, marginBottom: 10 },
  explainItem: { marginBottom: 8 },
  explainHead: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  explainText: { fontSize: 9.5, lineHeight: 1.55, textAlign: "justify" },
});

// ── 텍스트 유틸 ──
interface Choice {
  label: string;
  text: string;
  isCorrect: boolean;
}

function parseChoices(json: string): Choice[] {
  try {
    const raw = JSON.parse(json) as Choice[];
    if (!Array.isArray(raw)) return [];
    return normalizeMarkerChoices(raw.map((c, i) => ({ label: c.label ?? CIRCLE[i] ?? "", text: c.text ?? "", isCorrect: !!c.isCorrect })));
  } catch {
    return [];
  }
}

// 지문 끝의 "* 단어: 뜻" 줄을 각주로 분리
function splitFootnotes(passage: string): { body: string; notes: string[] } {
  const lines = (passage ?? "").replace(/\s+$/, "").split("\n");
  const notes: string[] = [];
  while (lines.length > 0 && /^\s*\*+\s*\S/.test(lines[lines.length - 1])) {
    notes.unshift(lines.pop()!.trim());
  }
  return { body: lines.join("\n").replace(/\s+$/, ""), notes };
}

// "______(A)______" 처럼 라벨을 감싼 빈칸은 짧은 빈칸 "____(A)____"으로(요약문 등)
const SHORT_BLANK_MARK = "";
const SHORT_BLANK = "_".repeat(7);
function shortenLabeledBlanks(text: string): string {
  return (text ?? "").replace(/_{3,}\s*(\([A-E]\))\s*_{3,}/g, `${SHORT_BLANK_MARK}$1${SHORT_BLANK_MARK}`);
}

// 빈칸·밑줄 런 (빈칸은 이웃 일반 텍스트와 합쳐 구두점과 붙어 다니게)
function inlineRuns(text: string): { text: string; underline: boolean }[] {
  const runs: { text: string; underline: boolean }[] = [];
  for (const seg of splitInlineUnderline(normalizeUnderlineTags(shortenLabeledBlanks(text)))) {
    const piece = seg.blank ? BLANK_TEXT : seg.text.replaceAll(SHORT_BLANK_MARK, SHORT_BLANK);
    const underline = !seg.blank && seg.underline;
    const last = runs[runs.length - 1];
    if (last && !last.underline && !underline) last.text += piece;
    else runs.push({ text: piece, underline });
  }
  return runs;
}

function Inline({ text, style }: { text: string; style: ComponentProps<typeof View>["style"] }) {
  return (
    <T style={style}>
      {inlineRuns(text).map((r, i) =>
        r.underline ? (
          <T key={i} style={{ textDecoration: "underline" }}>
            {r.text}
          </T>
        ) : (
          r.text
        )
      )}
    </T>
  );
}

function measureText(text: string): string {
  return splitInlineUnderline(normalizeUnderlineTags(shortenLabeledBlanks(text)))
    .map((x) => (x.blank ? BLANK_TOKEN : x.text.replaceAll(SHORT_BLANK_MARK, SHORT_BLANK)))
    .join("");
}

const serifLines = (text: string, fs: number, width: number, extra: { bold?: boolean; indent?: number } = {}) =>
  countLines(measureText(text), fs, width, {
    metrics: SERIF_METRICS,
    blankWidth: BLANK_W,
    bold: extra.bold,
    firstLineIndent: extra.indent,
  });

// ── 선지 배치: 모든 선지가 들어가는 최대 개수(5·3·2·1)로 한 줄에 배치 ──
function choicesPerRow(choices: Choice[], width: number): number {
  for (const n of [5, 3, 2]) {
    const cell = width / n;
    const fits = choices.every(
      (c, i) => textWidth(`${CIRCLE[i] ?? ""} ${c.text}`, C_FS, false, SERIF_METRICS) + 14 <= cell - 4
    );
    if (fits) return n;
  }
  return 1;
}

function choicesHeight(choices: Choice[], width = COL_W - INSET): number {
  if (choices.length === 0) return 0;
  if (isMarkerOnlyChoices(choices)) return C_LH + C_GAP;
  const n = choicesPerRow(choices, width);
  if (n > 1) return Math.ceil(choices.length / n) * (C_LH + C_GAP);
  return choices.reduce(
    (h, c) => h + countLines(c.text, C_FS, width - 14, { metrics: SERIF_METRICS }) * C_LH + C_GAP,
    0
  );
}

function Choices({ choices, highlight }: { choices: Choice[]; highlight: boolean }) {
  const width = COL_W - INSET;
  const mark = (c: Choice) => (highlight && c.isCorrect ? { color: RED, fontWeight: 700 as const } : {});
  if (isMarkerOnlyChoices(choices)) {
    return (
      <View style={[s.choicesWrap, s.choiceRow, { justifyContent: "space-between", paddingRight: 20 }]}>
        {choices.map((c, i) => (
          <T key={i} style={[{ fontSize: C_FS, lineHeight: 1.45 }, mark(c)]}>
            {CIRCLE[i]}
          </T>
        ))}
      </View>
    );
  }
  const n = choicesPerRow(choices, width);
  const rows: Choice[][] = [];
  for (let i = 0; i < choices.length; i += n) rows.push(choices.slice(i, i + n));
  return (
    <View style={s.choicesWrap}>
      {rows.map((row, r) => (
        <View key={r} style={s.choiceRow}>
          {row.map((c, k) => {
            const idx = r * n + k;
            return (
              <View key={k} style={[s.choiceCell, { width: n === 1 ? width : width / n }]}>
                <T style={[s.choiceLabel, mark(c)]}>{CIRCLE[idx]}</T>
                <T style={[s.choiceText, mark(c)]}>{c.text}</T>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── 블록(단에 배치되는 단위) ──
interface Block {
  key: string;
  height: number;
  render: (highlight: boolean, mode: "student" | "teacher") => ReactNode;
}

const PASSAGE_W = COL_W - INSET;
const BOX_TEXT_W = COL_W - INSET - BOX_PAD_X * 2 - BOX_BORDER * 2;

function passageHeight(text: string, width = PASSAGE_W): number {
  return serifLines(text, P_FS, width, { indent: P_INDENT }) * P_LH + 6;
}
function boxHeight(text: string): number {
  return BOX_PAD_Y * 2 + BOX_BORDER * 2 + serifLines(text, P_FS, BOX_TEXT_W, { indent: P_INDENT }) * P_LH + 6;
}
function footnotesHeight(notes: string[]): number {
  return notes.length === 0 ? 0 : notes.length * FN_LH + 4;
}

function questionBlock(
  item: MockExamItem,
  displayNo: number,
  opts: { groupHead?: string; numberOnly?: boolean }
): Block {
  const q = item.question;
  const pts = item.customPoints || q.points;
  const choices = isWritingType(q.questionType) ? [] : parseChoices(q.choices);
  const { body, notes } = splitFootnotes(q.passage);
  const parsed = parsePassage(body, q.questionType);
  // 묶음 문항은 발문을 묶음 머리에 한 번만 쓰고, 번호 옆엔 배점만
  const stem = opts.numberOnly ? (pts >= 3 ? "[3점]" : "") : q.question + (pts >= 3 ? " [3점]" : "");

  let h = 0;
  if (opts.groupHead) h += serifLines(opts.groupHead, 10.5, COL_W, { bold: true }) * 10.5 * 1.45 + 6;
  h += stem ? Math.max(serifLines(stem, Q_FS, COL_W - NUM_W) * Q_LH, 11 * 1.45) + 6 : 11 * 1.45 + 6;

  let content: ReactNode = null;
  switch (parsed.type) {
    case "order":
      h += boxHeight(parsed.givenParagraph);
      for (const seg of parsed.segments) {
        h += serifLines(seg.text, P_FS, PASSAGE_W - 22) * P_LH + 3;
      }
      content = (
        <>
          <View style={s.box}>
            <Inline text={parsed.givenParagraph} style={s.boxText} />
          </View>
          {parsed.segments.map((seg, i) => (
            <View key={i} style={s.segRow}>
              <T style={s.segLabel}>{seg.label}</T>
              <Inline text={seg.text} style={s.segText} />
            </View>
          ))}
        </>
      );
      break;
    case "insertion": {
      const bodyText = parsed.bodyParts.map((p) => (p.marker ? ` ( ${p.marker} ) ` : p.text)).join("");
      h += boxHeight(parsed.givenSentence) + passageHeight(bodyText);
      content = (
        <>
          <View style={s.box}>
            <Inline text={parsed.givenSentence} style={s.boxText} />
          </View>
          <T style={s.passage}>{bodyText}</T>
        </>
      );
      break;
    }
    case "grammar": {
      const flat = parsed.parts.map((p) => (p.underlined ? `${p.marker ?? ""}${p.underlined}` : p.text)).join("");
      h += passageHeight(flat);
      content = (
        <T style={s.passage}>
          {parsed.parts.map((p, i) =>
            p.underlined ? (
              <T key={i}>
                {p.marker ?? ""}
                <T style={{ textDecoration: "underline" }}>{p.underlined}</T>
              </T>
            ) : (
              <T key={i}>{p.text}</T>
            )
          )}
        </T>
      );
      break;
    }
    case "summary":
      h += passageHeight(parsed.mainPassage) + 18 + boxHeight(parsed.summaryText);
      content = (
        <>
          <Inline text={parsed.mainPassage} style={s.passage} />
          <T style={s.arrow}>↓</T>
          <View style={s.box}>
            <Inline text={parsed.summaryText} style={s.boxText} />
          </View>
        </>
      );
      break;
    case "writing":
      if (parsed.passage) h += passageHeight(parsed.passage);
      content = parsed.passage ? <Inline text={parsed.passage} style={s.passage} /> : null;
      break;
    default:
      if (parsed.text) h += passageHeight(parsed.text);
      content = parsed.text ? <Inline text={parsed.text} style={s.passage} /> : null;
  }
  h += footnotesHeight(notes);

  // 요약문은 (A) …… (B) 표 형태 선지
  const summaryRows =
    parsed.type === "summary"
      ? choices.map((c) => {
          const m = c.text.match(/\(A\)\s*(.+?)\s*[…·\-—]{1,}\s*\(B\)\s*(.+)$/);
          return { a: m ? m[1] : c.text, b: m ? m[2] : "", isCorrect: c.isCorrect };
        })
      : null;
  if (summaryRows) h += (summaryRows.length + 1) * (C_LH + C_GAP);
  else h += choicesHeight(choices);
  const writing = isWritingType(q.questionType);
  if (writing) h += 66;

  return {
    key: `q${displayNo}`,
    height: h,
    render: (highlight, mode) => (
      <View>
        {opts.groupHead && <T style={s.groupHead}>{opts.groupHead}</T>}
        <View style={s.qRow}>
          <T style={s.qNum}>{displayNo}.</T>
          {stem ? <T style={s.qText}>{stem}</T> : null}
        </View>
        {content}
        {notes.map((n, i) => (
          <T key={i} style={s.footnote}>
            {n}
          </T>
        ))}
        {summaryRows ? (
          <View style={s.choicesWrap}>
            <View style={s.choiceRow}>
              <T style={[s.choiceLabel]}> </T>
              <T style={{ width: (PASSAGE_W - 14) / 2, fontSize: C_FS, textAlign: "center" }}>(A)</T>
              <T style={{ width: (PASSAGE_W - 14) / 2, fontSize: C_FS, textAlign: "center" }}>(B)</T>
            </View>
            {summaryRows.map((r, i) => {
              const st = highlight && r.isCorrect ? { color: RED, fontWeight: 700 as const } : {};
              return (
                <View key={i} style={s.choiceRow}>
                  <T style={[s.choiceLabel, st]}>{CIRCLE[i]}</T>
                  <T style={[{ width: (PASSAGE_W - 14) / 2, fontSize: C_FS, lineHeight: 1.45, textAlign: "center" }, st]}>
                    {r.a}
                  </T>
                  <T style={[{ width: (PASSAGE_W - 14) / 2, fontSize: C_FS, lineHeight: 1.45, textAlign: "center" }, st]}>
                    {r.b}
                  </T>
                </View>
              );
            })}
          </View>
        ) : (
          <Choices choices={choices} highlight={highlight} />
        )}
        {writing && mode === "student" && <View style={s.answerArea} />}
      </View>
    ),
  };
}

function noticeBlock(key: string, text: string): Block {
  const h = BOX_PAD_Y * 2 + BOX_BORDER * 2 + serifLines(text, P_FS, COL_W - BOX_PAD_X * 2 - BOX_BORDER * 2, { indent: P_INDENT }) * P_FS * 1.5;
  return {
    key,
    height: h,
    render: () => (
      <View style={s.noticeBox}>
        <T style={s.noticeText}>{text}</T>
      </View>
    ),
  };
}

const LISTENING_START =
  "1번부터 17번까지는 듣고 답하는 문제입니다. 1번부터 15번까지는 한 번만 들려주고, 16번부터 17번까지는 두 번 들려줍니다. 방송을 잘 듣고 답을 하시기 바랍니다.";
const LISTENING_END = "이제 듣기 문제가 끝났습니다. 18번부터는 문제지의 지시에 따라 답을 하시기 바랍니다.";
const CHECK_NOTICE = "* 확인 사항\n답안지의 해당란에 필요한 내용을 정확히 기입(표기)했는지 확인하시오.";

// 연속 문항의 발문이 같으면 [n~m] 묶음 머리로 한 번만 쓴다
function buildBlocks(items: MockExamItem[], offset: number, includeListening: boolean): Block[] {
  const blocks: Block[] = [];
  if (includeListening) {
    blocks.push(noticeBlock("ls", LISTENING_START));
    blocks.push(noticeBlock("le", LISTENING_END));
  }
  let i = 0;
  while (i < items.length) {
    const stem = (items[i].question.question ?? "").trim();
    let j = i + 1;
    while (j < items.length && stem.length > 0 && (items[j].question.question ?? "").trim() === stem) {
      j++;
    }
    if (j - i >= 2) {
      const first = items[i].orderNum + offset;
      const last = items[j - 1].orderNum + offset;
      for (let k = i; k < j; k++) {
        blocks.push(
          questionBlock(items[k], items[k].orderNum + offset, {
            groupHead: k === i ? `[${first}~${last}] ${stem}` : undefined,
            numberOnly: true,
          })
        );
      }
    } else {
      blocks.push(questionBlock(items[i], items[i].orderNum + offset, {}));
    }
    i = j;
  }
  blocks.push(noticeBlock("check", CHECK_NOTICE));
  return blocks;
}

// 쪽 배치 계획(렌더링과 테스트가 같은 계산을 쓴다)
export function planMockPages(items: MockExamItem[], options: MockExamOptions) {
  const offset = options.includeListening ? 17 : 0;
  // 긴 지문일수록 추정 오차(양쪽 정렬·굵은 정답 표시 등)가 커서 고정 여유만으론 부족 → 비례 여유 3%
  return packColumns(buildBlocks(items, offset, options.includeListening), (b) => b.height * 1.03, {
    columnsPerPage: 2,
    columnHeight: colHeightFor,
    gap: ITEM_GAP,
  });
}

// ── 머리·쪽수 ──
function FirstHeader({ o }: { o: MockExamOptions }) {
  return (
    <View style={s.firstHeader}>
      <View style={s.examNameRow}>
        <View style={{ width: 40 }} />
        <T style={s.examName}>{o.examName}</T>
        <T style={s.bigPageNo}>1</T>
      </View>
      <View style={s.titleRow}>
        <View style={{ width: 90 }}>
          <View style={[s.periodBox, { alignSelf: "flex-start" }]}>
            <T style={s.periodText}>{o.period}</T>
          </View>
        </View>
        <T style={s.bigTitle}>{o.subject}</T>
        <View style={{ width: 90 }} />
      </View>
      <View style={s.ruleThick} />
    </View>
  );
}

function PageHeader({ o, pageNo }: { o: MockExamOptions; pageNo: number }) {
  const odd = pageNo % 2 === 1;
  const num = <T style={[s.pageNo, { textAlign: odd ? "right" : "left" }]}>{pageNo}</T>;
  const grade = (
    <View style={s.gradeBox}>
      <T style={s.gradeText}>{o.grade || " "}</T>
    </View>
  );
  return (
    <View style={s.header}>
      <View style={s.headerRow}>
        {odd ? grade : num}
        <T style={s.headerTitle}>{o.subject}</T>
        {odd ? num : grade}
      </View>
      <View style={[s.ruleThick, { borderBottomWidth: 1.2 }]} />
    </View>
  );
}

function Footer({ pageNo, total }: { pageNo: number; total: number }) {
  return (
    <View style={s.footer}>
      <View style={s.slashBox}>
        <Svg width={52} height={20} style={{ position: "absolute", top: 0, left: 0 }}>
          <Line x1="6" y1="19" x2="46" y2="1" stroke="#111111" strokeWidth={0.8} />
        </Svg>
        <T style={s.slashNo}>{pageNo}</T>
        <T style={s.slashTotal}>{total}</T>
      </View>
    </View>
  );
}

function correctLabel(json: string): string {
  const idx = parseChoices(json).findIndex((c) => c.isCorrect);
  return idx >= 0 ? CIRCLE[idx] ?? String(idx + 1) : "?";
}

export default function MockExamPDF({
  items,
  options,
  mode = "student",
  showAnswers = false,
  revealOverflow = false,
}: MockExamPDFProps) {
  const offset = options.includeListening ? 17 : 0;
  const highlight = mode === "teacher" || showAnswers;
  const pages = planMockPages(items, options);
  const total = pages.length;

  const column = (list: Block[]) => (
    <View style={s.column}>
      {list.map((b, k) => (
        <View key={b.key} style={{ marginBottom: k < list.length - 1 ? ITEM_GAP : 0 }}>
          {b.render(highlight, mode)}
        </View>
      ))}
    </View>
  );

  return (
    <Document>
      {pages.map((pg, i) => {
        const pageNo = i + 1;
        return (
          // 단 페이지는 추정 오차가 있어도 다음 쪽으로 넘어가지 않게(빈 쪽 방지) wrap 끔
          <Page key={i} size="A4" style={s.page} wrap={revealOverflow || pg.kind !== "columns"}>
            {i === 0 ? <FirstHeader o={options} /> : <PageHeader o={options} pageNo={pageNo} />}
            {pg.kind === "columns" ? (
              <View style={s.columns}>
                {column(pg.columns[0] ?? [])}
                <View style={s.divider}>
                  <View style={s.dividerLine} />
                </View>
                {column(pg.columns[1] ?? [])}
              </View>
            ) : (
              // 한 단을 넘는 블록: 페이지 전체 폭
              <View style={{ paddingTop: 10 }}>{pg.item.render(highlight, mode)}</View>
            )}
            <Footer pageNo={pageNo} total={total} />
          </Page>
        );
      })}
      {mode === "teacher" && (
        <Page size="A4" style={s.page}>
          <T style={s.answerTitle}>정답</T>
          <View style={s.answerGrid}>
            {items
              .filter((it) => !isWritingType(it.question.questionType))
              .map((it) => (
                <View key={it.orderNum} style={s.answerCell}>
                  <T style={s.answerNum}>{it.orderNum + offset}</T>
                  <T style={s.answerVal}>{correctLabel(it.question.choices)}</T>
                </View>
              ))}
          </View>
          {/* 문제를 만들 때 함께 만든 해설(번호순) */}
          {items.some((it) => (it.question.explanation ?? "").trim()) && (
            <>
              <T style={s.explainTitle}>해설</T>
              {items
                .filter((it) => (it.question.explanation ?? "").trim())
                .map((it) => (
                  <View key={it.orderNum} style={s.explainItem} wrap={false}>
                    <T style={s.explainHead}>
                      {it.orderNum + offset}번
                      {isWritingType(it.question.questionType) ? "" : `  정답 ${correctLabel(it.question.choices)}`}
                    </T>
                    <T style={s.explainText}>{(it.question.explanation ?? "").trim()}</T>
                  </View>
                ))}
            </>
          )}
        </Page>
      )}
    </Document>
  );
}
