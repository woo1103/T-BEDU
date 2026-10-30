"use client";

import type { ComponentProps } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Line,
  Font,
} from "@react-pdf/renderer";
import {
  parsePassage,
  isWritingType,
  normalizeUnderlineTags,
  splitInlineUnderline,
  normalizeMarkerChoices,
  isMarkerOnlyChoices,
  type OrderParsed,
  type InsertionParsed,
  type GrammarParsed,
  type SummaryParsed,
  type ParsedPassage,
  splitChart,
} from "@/lib/passage-parser";
import { BLANK_TOKEN, countLines, packColumns, textWidth } from "@/lib/pdf-layout";
import { groupSetRuns, SET_HEAD, splitSetPassage } from "@/lib/question-sets";
import ChartPDF, { chartPdfHeight } from "@/components/pdf/ChartPDF";

// 한글 폰트 등록 — 로컬 Noto Sans KR 전체 TTF (한글·라틴·CJK 원문자 등 전 글리프 포함)
// 이전 버전은 fontsource의 korean 서브셋만 로드되어 "1." 이나 "①" 같은 글자가 깨졌음.
// 브라우저에선 /fonts URL, 테스트(Node)에선 디스크 경로
const FONT_BASE = typeof window === "undefined" ? `${process.cwd()}/public/fonts` : "/fonts";
Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: `${FONT_BASE}/NotoSansKR-Regular.ttf`,
      fontWeight: 400,
    },
    {
      src: `${FONT_BASE}/NotoSansKR-Bold.ttf`,
      fontWeight: 700,
    },
  ],
});

// 줄 끝에서 단어를 쪼개며 "-"를 넣는 기본 하이픈 처리를 끈다(단어 단위로만 줄바꿈).
Font.registerHyphenationCallback((word) => [word]);

// react-pdf는 스타일이 바뀌는 지점(예: "③"+밑줄 단어, 빈칸+마침표)을 하이픈 줄바꿈 후보로 본다.
// 페널티를 무한대(10000)로 두면 그 지점에서 끊지 않는다. (런타임 지원 prop이나 타입 정의엔 없음)
const NO_HYPHEN_BREAK = { hyphenationPenalty: 10000 } as object;
function PText(props: ComponentProps<typeof Text>) {
  return <Text {...NO_HYPHEN_BREAK} {...props} />;
}

const BRAND_CYAN = "#4FC3F7";
const BRAND_DARK_CYAN = "#29B6F6";
const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];
// 빈칸: 원본 밑줄 개수와 무관하게 이 길이로 통일(9.5pt 기준 약 30mm)
const BLANK_TEXT = "_".repeat(16);

interface Choice {
  label: string;
  text: string;
  isCorrect: boolean;
}

interface ExamQuestion {
  passage: string;
  question: string;
  choices: string;
  answer: string;
  points: number;
  questionType: string;
  explanation?: string | null;
  setId?: string | null;
}

// __...__ 와 <u>...</u> 를 실제 밑줄 Text로, 빈칸(___)은 고정 폭 빈칸으로 렌더링
function PassageInline({
  text,
  style,
}: {
  text: string;
  style?: ReturnType<typeof StyleSheet.create>[string];
}) {
  // 빈칸은 앞뒤 일반 텍스트와 한 문자열로 합친다(빈칸과 뒤 구두점이 한 단어로 붙어 다니도록).
  const runs: { text: string; underline: boolean }[] = [];
  for (const seg of splitInlineUnderline(normalizeUnderlineTags(text))) {
    const piece = seg.blank ? BLANK_TEXT : seg.text;
    const underline = !seg.blank && seg.underline;
    const last = runs[runs.length - 1];
    if (last && !last.underline && !underline) last.text += piece;
    else runs.push({ text: piece, underline });
  }
  return (
    <PText style={style}>
      {runs.map((r, i) =>
        r.underline ? (
          <PText key={i} style={{ textDecoration: "underline" }}>
            {r.text}
          </PText>
        ) : (
          r.text
        )
      )}
    </PText>
  );
}

export interface ExamItemData {
  orderNum: number;
  customPoints: number | null;
  question: ExamQuestion;
  // 장문 세트 머리(지문만 담은 가짜 문항): "[41~42] 다음 글을 읽고, 물음에 답하시오."
  setHead?: string;
  // 세트 지문의 둘째 문단부터(머리 없이 지문만)
  passageOnly?: boolean;
}

// 장문 세트는 지문을 머리 한 번에만 싣고, 세트 문항은 발문·선지만 남긴다
function expandSets(items: ExamItemData[]): ExamItemData[] {
  return groupSetRuns(items).flatMap((run) => {
    if (!run.set) return run.items;
    const first = run.items[0];
    const last = run.items[run.items.length - 1];
    // 문단마다 따로 두어 단에 차례로 흘려 넣는다
    const paras = splitSetPassage(first.question.passage);
    const pseudo = (passage: string, k: number): ExamItemData => ({
      ...first,
      setHead: k === 0 ? `[${first.orderNum}~${last.orderNum}] ${SET_HEAD}` : undefined,
      passageOnly: k > 0,
      question: { ...first.question, passage, question: "", choices: "[]", questionType: "__set_passage" },
    });
    return [
      ...paras.map(pseudo),
      ...run.items.map((it) => ({ ...it, question: { ...it.question, passage: "" } })),
    ];
  });
}

export interface ExamPDFProps {
  title: string;
  items: ExamItemData[];
  showAnswers?: boolean;
  mode?: "student" | "teacher";
}

const styles = StyleSheet.create({
  // === 표지 ===
  coverPage: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    fontFamily: "NotoSansKR",
  },
  coverDecoLines: {
    position: "absolute",
    top: 30,
    right: 40,
  },
  coverCircleArea: {
    position: "absolute",
    top: 80,
    left: 48,
    width: 500,
    height: 500,
  },
  coverTitleInCircle: {
    position: "absolute",
    top: 280,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  coverTitleText: {
    fontSize: 28,
    fontWeight: 700,
    color: BRAND_CYAN,
    letterSpacing: 2,
  },
  coverBrand: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  coverBrandText: {
    fontSize: 24,
    fontWeight: 700,
    color: BRAND_CYAN,
    letterSpacing: 3,
  },

  // === 내지 ===
  contentPage: {
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 0,
    fontFamily: "NotoSansKR",
  },
  headerBar: {
    backgroundColor: BRAND_CYAN,
    height: 8,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottom: `1px solid #E0E0E0`,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: BRAND_CYAN,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  headerLogoText: {
    fontSize: 10,
    fontWeight: 700,
    color: BRAND_DARK_CYAN,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#333333",
  },
  headerSub: {
    fontSize: 8,
    color: "#999999",
    marginLeft: "auto",
  },

  // 2단 레이아웃
  columnsContainer: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 14,
    flex: 1,
  },
  column: {
    flex: 1,
    paddingHorizontal: 10,
  },
  columnDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 4,
  },

  // 문항
  questionBlock: {
    marginBottom: 18,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: 700,
    color: "#333333",
    marginRight: 6,
  },
  questionPoints: {
    fontSize: 8,
    color: "#666666",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 6,
    marginTop: 1,
  },
  questionText: {
    fontSize: 10,
    color: "#333333",
    fontWeight: 700,
    flex: 1,
    lineHeight: 1.5,
  },
  passageBox: {
    borderWidth: 1,
    borderColor: "#D0D0D0",
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
  },
  passageText: {
    fontSize: 9.5,
    lineHeight: 1.6,
    color: "#333333",
  },
  choicesBlock: {
    marginTop: 2,
  },
  choiceRow: {
    flexDirection: "row",
    marginBottom: 5,
    paddingLeft: 4,
  },
  choiceLabel: {
    fontSize: 9.5,
    color: "#444444",
    width: 18,
    fontWeight: 700,
  },
  choiceLabelCorrect: {
    fontSize: 9.5,
    color: "#E53935",
    width: 18,
    fontWeight: 700,
  },
  choiceText: {
    fontSize: 9.5,
    color: "#444444",
    flex: 1,
    lineHeight: 1.5,
  },
  choiceTextCorrect: {
    fontSize: 9.5,
    color: "#E53935",
    fontWeight: 700,
    flex: 1,
    lineHeight: 1.5,
  },
  splitChoicesHeader: {
    fontSize: 9,
    color: "#999999",
    marginBottom: 6,
    fontWeight: 700,
  },

  // 주어진 글/문장 박스 (굵은 테두리)
  givenBox: {
    borderWidth: 1.5,
    borderColor: "#333333",
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },

  // 세그먼트 레이블
  segmentLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#333333",
    marginRight: 4,
  },
  segmentBlock: {
    marginBottom: 6,
    paddingLeft: 4,
  },

  // 밑줄 텍스트
  underlinedText: {
    fontSize: 9.5,
    textDecoration: "underline",
    color: "#333333",
  },
  markerText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#333333",
  },

  // 요약문
  summaryArrow: {
    textAlign: "center",
    fontSize: 14,
    color: "#999999",
    marginVertical: 4,
  },
  summaryChoiceTable: {
    flexDirection: "row",
    marginTop: 8,
    paddingLeft: 4,
  },
  summaryChoiceColumn: {
    flex: 1,
    paddingHorizontal: 4,
  },
  summaryChoiceHeader: {
    fontSize: 9,
    fontWeight: 700,
    color: "#666666",
    marginBottom: 4,
    textAlign: "center",
  },
  summaryChoiceRow: {
    flexDirection: "row",
    marginBottom: 3,
  },

  // 서술형 답안란
  writingAnswerArea: {
    borderWidth: 1,
    borderColor: "#D0D0D0",
    borderStyle: "dashed",
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    minHeight: 60,
  },
  writingAnswerLabel: {
    fontSize: 8,
    color: "#BBBBBB",
  },

  // 해설지 채점기준 박스
  gradingBox: {
    borderWidth: 1,
    borderColor: "#FFCDD2",
    borderRadius: 4,
    padding: 8,
    marginTop: 6,
    backgroundColor: "#FFF8F8",
  },
  gradingTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: "#E53935",
    marginBottom: 4,
  },
  gradingText: {
    fontSize: 8,
    color: "#666666",
    lineHeight: 1.5,
    marginBottom: 2,
  },
  gradingTextCorrect: {
    fontSize: 8,
    color: "#E53935",
    fontWeight: 700,
    lineHeight: 1.5,
    marginBottom: 2,
  },

  // 정답 표
  answerSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  answerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#333333",
    marginBottom: 8,
    textAlign: "center",
  },
  answerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
  },
  answerCell: {
    width: 50,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#D0D0D0",
    borderRadius: 2,
    overflow: "hidden",
  },
  answerNum: {
    fontSize: 8,
    fontWeight: 700,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 4,
    paddingVertical: 3,
    width: 20,
    textAlign: "center",
  },
  answerVal: {
    fontSize: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flex: 1,
    textAlign: "center",
    color: "#E53935",
    fontWeight: 700,
  },

  // 서술형 해설지 항목
  explainSection: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  explainItem: {
    marginBottom: 8,
  },
  explainHead: {
    fontSize: 9,
    fontWeight: 700,
    color: "#333333",
    marginBottom: 2,
  },
  explainText: {
    fontSize: 8.5,
    color: "#444444",
    lineHeight: 1.55,
  },
  writingAnswerSection: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  writingAnswerTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#333333",
    marginBottom: 6,
    marginTop: 12,
  },
});

// ── 표지 페이지 ──
function CoverPage() {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverDecoLines}>
        <Svg width={80} height={60}>
          <Line x1="20" y1="0" x2="80" y2="0" stroke={BRAND_CYAN} strokeWidth="2" />
          <Line x1="30" y1="15" x2="80" y2="15" stroke={BRAND_CYAN} strokeWidth="2" />
          <Line x1="40" y1="30" x2="80" y2="30" stroke={BRAND_CYAN} strokeWidth="1.5" />
        </Svg>
      </View>
      <View style={styles.coverCircleArea}>
        <Svg width={500} height={500}>
          <Circle cx="250" cy="250" r="220" fill="none" stroke={BRAND_DARK_CYAN} strokeWidth="1.5" />
          <Circle cx="250" cy="250" r="200" fill="none" stroke={BRAND_CYAN} strokeWidth="8" opacity="0.4" />
          <Circle cx="250" cy="250" r="180" fill="none" stroke={BRAND_CYAN} strokeWidth="1" strokeDasharray="8,6" />
        </Svg>
      </View>
      <View style={styles.coverTitleInCircle}>
        <PText style={styles.coverTitleText}>Daily Gift</PText>
      </View>
      <View style={styles.coverBrand}>
        <PText style={styles.coverBrandText}>T&BEDU</PText>
      </View>
    </Page>
  );
}

function parseChoices(choicesJson: string): Choice[] {
  try {
    const raw = JSON.parse(choicesJson) as Choice[];
    // 선지가 ①~⑤ 마커로만 구성된 경우 ①→⑤ 순서로 정렬 + "문장 끝" 제거
    // 영어/한글 선지는 그대로 통과.
    return normalizeMarkerChoices(raw);
  } catch {
    return [];
  }
}

// ── 문제 헤더 (번호 + 배점 + 발문) ──
function QuestionHeaderRow({ item }: { item: ExamItemData }) {
  const pts = item.customPoints || item.question.points;
  if (item.passageOnly) return null;
  if (item.setHead) {
    return (
      <View style={styles.questionHeader}>
        <PText style={styles.questionText}>{item.setHead}</PText>
      </View>
    );
  }
  return (
    <View style={styles.questionHeader}>
      <PText style={styles.questionNumber}>{item.orderNum}.</PText>
      {pts >= 3 && <PText style={styles.questionPoints}>{pts}점</PText>}
      <PText style={styles.questionText}>{item.question.question}</PText>
    </View>
  );
}

// ── 선지 블록 ──
function ChoicesBlock({
  item,
  showAnswers,
  header,
}: {
  item: ExamItemData;
  showAnswers: boolean;
  header?: string;
}) {
  const choices = parseChoices(item.question.choices);
  // 선지가 ①~⑤ 마커뿐이면(어법·어휘 등) "① ①"처럼 겹치지 않게 번호만 한 줄로
  if (isMarkerOnlyChoices(choices)) {
    return (
      <View style={styles.choicesBlock}>
        {header && <PText style={styles.splitChoicesHeader}>{header}</PText>}
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingTop: 4 }}>
          {choices.map((choice, i) => (
            <PText
              key={i}
              style={showAnswers && choice.isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}
            >
              {CIRCLE_LABELS[i] || `${i + 1}.`}
            </PText>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.choicesBlock}>
      {header && <PText style={styles.splitChoicesHeader}>{header}</PText>}
      {choices.map((choice, i) => {
        const isCorrect = showAnswers && choice.isCorrect;
        const label = CIRCLE_LABELS[i] || `${i + 1}.`;
        return (
          <View key={i} style={styles.choiceRow}>
            <PText style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
              {label}
            </PText>
            <PText style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
              {choice.text}
            </PText>
          </View>
        );
      })}
    </View>
  );
}

// ── 순서배열 PDF ──
function OrderQuestionPDF({
  item,
  parsed,
  showAnswers,
}: {
  item: ExamItemData;
  parsed: OrderParsed;
  showAnswers: boolean;
}) {
  const choices = parseChoices(item.question.choices);
  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 주어진 글 박스 */}
      <View style={styles.givenBox}>
        <PText style={styles.passageText}>{parsed.givenParagraph}</PText>
      </View>
      {/* (A)(B)(C) 세그먼트 */}
      {parsed.segments.map((seg, i) => (
        <View key={i} style={styles.segmentBlock}>
          <PText style={styles.passageText}>
            <PText style={styles.segmentLabel}>{seg.label} </PText>
            {seg.text}
          </PText>
        </View>
      ))}
      {/* 선지 */}
      <View style={styles.choicesBlock}>
        {choices.map((choice, i) => {
          const isCorrect = showAnswers && choice.isCorrect;
          const label = CIRCLE_LABELS[i] || `${i + 1}.`;
          return (
            <View key={i} style={styles.choiceRow}>
              <PText style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
                {label}
              </PText>
              <PText style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                {choice.text}
              </PText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── 문장삽입 PDF ──
function InsertionQuestionPDF({
  item,
  parsed,
  showAnswers,
}: {
  item: ExamItemData;
  parsed: InsertionParsed;
  showAnswers: boolean;
}) {
  const choices = parseChoices(item.question.choices);

  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 주어진 문장 박스 */}
      <View style={styles.givenBox}>
        <PText style={styles.passageText}>{parsed.givenSentence}</PText>
      </View>
      {/* 본문 (인라인 마커) */}
      <View style={styles.passageBox}>
        <PText style={styles.passageText}>
          {parsed.bodyParts.map((part, i) =>
            part.marker ? (
              <PText key={i} style={{ fontWeight: 700 }}>
                {" "}
                {part.marker}
                {" "}
              </PText>
            ) : (
              <PText key={i}>{part.text}</PText>
            )
          )}
        </PText>
      </View>
      {/* 선지: 문장삽입은 항상 ①~⑤ 순서 고정 (한 줄 배치) */}
      <View style={[styles.choicesBlock, { flexDirection: "row", justifyContent: "space-around", paddingTop: 4 }]}>
        {CIRCLE_LABELS.map((label, i) => {
          const choice = choices[i];
          const isCorrect = showAnswers && choice?.isCorrect;
          return (
            <PText
              key={i}
              style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}
            >
              {label}
            </PText>
          );
        })}
      </View>
    </View>
  );
}

// ── 어법/어휘 PDF ──
function GrammarVocabQuestionPDF({
  item,
  parsed,
  showAnswers,
}: {
  item: ExamItemData;
  parsed: GrammarParsed;
  showAnswers: boolean;
}) {
  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 지문 (밑줄+마커 포함) */}
      <View style={styles.passageBox}>
        <PText style={styles.passageText}>
          {parsed.parts.map((part, i) =>
            part.underlined ? (
              <PText key={i}>
                <PText style={styles.markerText}>{part.marker || ""}</PText>
                <PText style={styles.underlinedText}>{part.underlined}</PText>
              </PText>
            ) : (
              <PText key={i}>{part.text}</PText>
            )
          )}
        </PText>
      </View>
      {/* 선지 */}
      <ChoicesBlock item={item} showAnswers={showAnswers} />
    </View>
  );
}

// ── 요약문 PDF ──
function SummaryQuestionPDF({
  item,
  parsed,
  showAnswers,
}: {
  item: ExamItemData;
  parsed: SummaryParsed;
  showAnswers: boolean;
}) {
  const choices = parseChoices(item.question.choices);

  // (A)/(B) 쌍 파싱
  const parsedChoices = choices.map((c) => {
    const text = c.text ?? "";
    const match = text.match(
      /\(A\)\s*(\S+)\s*[…·\-—]+\s*\(B\)\s*(\S+)/
    );
    return {
      a: match ? match[1] : text,
      b: match ? match[2] : "",
      isCorrect: c.isCorrect,
    };
  });

  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 본문 박스 */}
      <View style={styles.passageBox}>
        <PassageInline text={parsed.mainPassage} style={styles.passageText} />
      </View>
      {/* 화살표 */}
      <PText style={styles.summaryArrow}>▼</PText>
      {/* 요약문 박스 */}
      <View style={styles.passageBox}>
        <PassageInline text={parsed.summaryText} style={styles.passageText} />
      </View>
      {/* (A)/(B) 선지 표 */}
      <View style={styles.summaryChoiceTable}>
        {/* (A) 열 */}
        <View style={styles.summaryChoiceColumn}>
          <PText style={styles.summaryChoiceHeader}>(A)</PText>
          {parsedChoices.map((c, i) => {
            const isCorrect = showAnswers && c.isCorrect;
            const label = CIRCLE_LABELS[i] || `${i + 1}.`;
            return (
              <View key={i} style={styles.summaryChoiceRow}>
                <PText style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
                  {label}
                </PText>
                <PText style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                  {c.a}
                </PText>
              </View>
            );
          })}
        </View>
        {/* 구분점 열 */}
        <View style={{ justifyContent: "center", paddingTop: 16 }}>
          {parsedChoices.map((_, i) => (
            <PText
              key={i}
              style={{ fontSize: 8, color: "#999999", marginBottom: 3, textAlign: "center" }}
            >
              ……
            </PText>
          ))}
        </View>
        {/* (B) 열 */}
        <View style={styles.summaryChoiceColumn}>
          <PText style={styles.summaryChoiceHeader}>(B)</PText>
          {parsedChoices.map((c, i) => {
            const isCorrect = showAnswers && c.isCorrect;
            return (
              <View key={i} style={styles.summaryChoiceRow}>
                <PText style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                  {c.b}
                </PText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── 서술형 PDF ──
function WritingQuestionPDF({
  item,
  mode,
}: {
  item: ExamItemData;
  showAnswers: boolean;
  mode: "student" | "teacher";
}) {
  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 지문 */}
      {item.question.passage && (
        <View style={styles.passageBox}>
          <PassageInline text={item.question.passage} style={styles.passageText} />
        </View>
      )}
      {/* 답안 작성란 (학생용) — 서술형에는 선지 없음 */}
      {mode === "student" && (
        <View style={styles.writingAnswerArea}>
          <PText style={styles.writingAnswerLabel}>답안 작성란</PText>
        </View>
      )}
    </View>
  );
}

// ── 기본 문제 (헤더+지문+선지 전부 포함) ──
function DefaultQuestionPDF({
  item,
  showAnswers,
}: {
  item: ExamItemData;
  showAnswers: boolean;
}) {
  const { chart, text } = splitChart(item.question.passage);
  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {chart && <ChartPDF chart={chart} width={COLUMN_INNER_W} fontFamily="NotoSansKR" />}
      {text && (
        <View style={styles.passageBox}>
          <PassageInline text={text} style={styles.passageText} />
        </View>
      )}
      <ChoicesBlock item={item} showAnswers={showAnswers} />
    </View>
  );
}

// ── 문제 렌더러 (유형별 분기) ──
function QuestionItem({
  item,
  showAnswers,
  mode,
}: {
  item: ExamItemData;
  showAnswers: boolean;
  mode: "student" | "teacher";
}) {
  const parsed = parsePassage(item.question.passage, item.question.questionType);

  switch (parsed.type) {
    case "order":
      return <OrderQuestionPDF item={item} parsed={parsed} showAnswers={showAnswers} />;
    case "insertion":
      return <InsertionQuestionPDF item={item} parsed={parsed} showAnswers={showAnswers} />;
    case "grammar":
      return <GrammarVocabQuestionPDF item={item} parsed={parsed} showAnswers={showAnswers} />;
    case "summary":
      return <SummaryQuestionPDF item={item} parsed={parsed} showAnswers={showAnswers} />;
    case "writing":
      return <WritingQuestionPDF item={item} showAnswers={showAnswers} mode={mode} />;
    default:
      return <DefaultQuestionPDF item={item} showAnswers={showAnswers} />;
  }
}

// ── 문제 헤더 + 지문만 (split 모드 좌측용) ──
function QuestionHead({ item }: { item: ExamItemData }) {
  const parsed = parsePassage(item.question.passage, item.question.questionType);

  return (
    <View style={styles.questionBlock}>
      <QuestionHeaderRow item={item} />

      {parsed.type === "order" && (
        <>
          <View style={styles.givenBox}>
            <PText style={styles.passageText}>{parsed.givenParagraph}</PText>
          </View>
          {parsed.segments.map((seg, i) => (
            <View key={i} style={styles.segmentBlock}>
              <PText style={styles.passageText}>
                <PText style={styles.segmentLabel}>{seg.label} </PText>
                {seg.text}
              </PText>
            </View>
          ))}
        </>
      )}

      {parsed.type === "insertion" && (
        <>
          <View style={styles.givenBox}>
            <PText style={styles.passageText}>{parsed.givenSentence}</PText>
          </View>
          <View style={styles.passageBox}>
            <PText style={styles.passageText}>
              {parsed.bodyParts.map((part, i) =>
                part.marker ? (
                  <PText key={i} style={{ fontWeight: 700 }}>
                    {" "}{part.marker}{" "}
                  </PText>
                ) : (
                  <PText key={i}>{part.text}</PText>
                )
              )}
            </PText>
          </View>
        </>
      )}

      {parsed.type === "grammar" && (
        <View style={styles.passageBox}>
          <PText style={styles.passageText}>
            {parsed.parts.map((part, i) =>
              part.underlined ? (
                <PText key={i}>
                  <PText style={styles.markerText}>{part.marker || ""}</PText>
                  <PText style={styles.underlinedText}>{part.underlined}</PText>
                </PText>
              ) : (
                <PText key={i}>{part.text}</PText>
              )
            )}
          </PText>
        </View>
      )}

      {parsed.type === "summary" && (
        <>
          <View style={styles.passageBox}>
            <PassageInline text={parsed.mainPassage} style={styles.passageText} />
          </View>
          <PText style={styles.summaryArrow}>▼</PText>
          <View style={styles.passageBox}>
            <PassageInline text={parsed.summaryText} style={styles.passageText} />
          </View>
        </>
      )}

      {parsed.type === "default" && splitChart(parsed.text).chart && (
        <ChartPDF chart={splitChart(parsed.text).chart!} width={COLUMN_INNER_W} fontFamily="NotoSansKR" />
      )}
      {(parsed.type === "default" || parsed.type === "writing") && item.question.passage && (
        <View style={styles.passageBox}>
          <PassageInline
            text={parsed.type === "default" ? splitChart(parsed.text).text : item.question.passage}
            style={styles.passageText}
          />
        </View>
      )}
    </View>
  );
}

// ── 문항 높이 추정 (단 패킹용) ──
// 아래 수치는 styles의 fontSize·lineHeight·padding·margin과 1:1로 대응한다. 스타일을 바꾸면 함께 바꿀 것.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const COLUMNS_PER_PAGE = 2;
const DIVIDER_W = 1 + 4 * 2; // columnDivider width + marginHorizontal
const COLUMN_INNER_W =
  (PAGE_W - 18 * 2 - DIVIDER_W * (COLUMNS_PER_PAGE - 1)) / COLUMNS_PER_PAGE - 10 * 2;
// 페이지 - 헤더바(8) - 헤더행(6*2+36+1) - columnsContainer paddingTop(14) - contentPage paddingBottom(20)
// 추정 오차 대비 여유 12pt
const COLUMN_HEIGHT = PAGE_H - 8 - 49 - 14 - 20 - 12;
const ITEM_GAP = 18;
const PASSAGE_FS = 9.5;
const PASSAGE_LH = PASSAGE_FS * 1.6;
const CHOICE_LH = PASSAGE_FS * 1.5;
const NATURAL_LH = 1.45; // lineHeight 미지정 Text(NotoSansKR ascent-descent)
const BLANK_W = textWidth(BLANK_TEXT, PASSAGE_FS);

// 측정용 텍스트: 밑줄 표기 제거, 빈칸은 BLANK_TOKEN으로
function measureText(text: string): string {
  return splitInlineUnderline(normalizeUnderlineTags(text ?? ""))
    .map((s) => (s.blank ? BLANK_TOKEN : s.text))
    .join("");
}

function passageLines(text: string, width: number): number {
  return countLines(measureText(text), PASSAGE_FS, width, { blankWidth: BLANK_W });
}

// passageBox(테두리 1) / givenBox(테두리 1.5): padding 10, marginBottom 10
function boxHeight(text: string, width: number, border = 1): number {
  return 20 + border * 2 + passageLines(text, width - 20 - border * 2) * PASSAGE_LH + 10;
}

function headerHeight(item: ExamItemData, width: number): number {
  if (item.passageOnly) return 0;
  if (item.setHead) return Math.max(countLines(item.setHead, 10, width, { bold: true }) * 15, 12 * NATURAL_LH) + 6;
  const pts = item.customPoints || item.question.points;
  const numW = textWidth(`${item.orderNum}.`, 12, true) + 6;
  const ptsW = pts >= 3 ? textWidth(`${pts}점`, 8) + 8 + 6 : 0;
  const lines = countLines(item.question.question ?? "", 10, width - numW - ptsW, { bold: true });
  return Math.max(lines * 15, 12 * NATURAL_LH) + 6;
}

function choicesHeight(item: ExamItemData, width: number, header?: string): number {
  const choices = parseChoices(item.question.choices);
  let h = 2 + (header ? 9 * NATURAL_LH + 6 : 0);
  if (isMarkerOnlyChoices(choices)) return h + 4 + PASSAGE_FS * NATURAL_LH; // 번호 한 줄
  for (const c of choices) {
    const lines = countLines(c.text ?? "", PASSAGE_FS, width - 4 - 18);
    h += Math.max(lines * CHOICE_LH, PASSAGE_FS * NATURAL_LH) + 5;
  }
  return h;
}

// 지문(헤더 포함, 선지 제외) 높이 — QuestionHead / 유형별 렌더러의 지문 부분과 대응
function headHeight(item: ExamItemData, parsed: ParsedPassage, width: number): number {
  let h = headerHeight(item, width);
  switch (parsed.type) {
    case "order":
      h += boxHeight(parsed.givenParagraph, width, 1.5);
      for (const seg of parsed.segments) {
        h += passageLines(`${seg.label} ${seg.text}`, width - 4) * PASSAGE_LH + 6;
      }
      break;
    case "insertion":
      h += boxHeight(parsed.givenSentence, width, 1.5);
      h += boxHeight(
        parsed.bodyParts.map((p) => (p.marker ? ` ${p.marker} ` : p.text)).join(""),
        width
      );
      break;
    case "grammar":
      h += boxHeight(
        parsed.parts.map((p) => (p.underlined ? `${p.marker ?? ""}${p.underlined}` : p.text)).join(""),
        width
      );
      break;
    case "summary":
      h += boxHeight(parsed.mainPassage, width) + (14 * NATURAL_LH + 8) + boxHeight(parsed.summaryText, width);
      break;
    case "writing":
      if (item.question.passage) h += boxHeight(parsed.passage, width);
      break;
    default: {
      const { chart, text } = splitChart(parsed.text);
      h += chartPdfHeight(chart, width);
      if (text) h += boxHeight(text, width);
    }
  }
  return h;
}

// 요약문 (A)/(B) 표 높이
function summaryTableHeight(item: ExamItemData, width: number): number {
  const colW = (width - 4 - 24) / 2 - 8 - 18;
  let h = 8 + 9 * NATURAL_LH + 4;
  for (const c of parseChoices(item.question.choices)) {
    const m = (c.text ?? "").match(/\(A\)\s*(\S+)\s*[…·\-—]+\s*\(B\)\s*(\S+)/);
    const a = m ? m[1] : c.text ?? "";
    const b = m ? m[2] : "";
    const lines = Math.max(countLines(a, PASSAGE_FS, colW), countLines(b, PASSAGE_FS, colW));
    h += lines * CHOICE_LH + 3;
  }
  return h;
}

// 문항 전체(단 하나에 그대로 그릴 때) 높이
function itemHeight(item: ExamItemData, mode: "student" | "teacher", width = COLUMN_INNER_W): number {
  const parsed = parsePassage(item.question.passage, item.question.questionType);
  const head = headHeight(item, parsed, width);
  switch (parsed.type) {
    case "insertion":
      return head + 4 + PASSAGE_FS * NATURAL_LH;
    case "summary":
      return head + summaryTableHeight(item, width);
    case "writing":
      return head + (mode === "student" ? 60 + 10 : 0);
    default:
      return head + choicesHeight(item, width);
  }
}

// 내지 페이지 배치 계획(렌더링과 테스트가 같은 계산을 쓴다)
export function planExamPages(items: ExamItemData[], mode: "student" | "teacher") {
  return packColumns(expandSets(items), (it) => itemHeight(it, mode), {
    columnsPerPage: COLUMNS_PER_PAGE,
    columnHeight: COLUMN_HEIGHT,
    gap: ITEM_GAP,
  });
}

// 페이지 헤더(브랜드 바 + 제목 행)
function PageHeader({ title }: { title: string }) {
  return (
    <>
      <View style={styles.headerBar} />
      <View style={styles.headerRow}>
        <View style={styles.headerLogo}>
          <PText style={styles.headerLogoText}>T&B</PText>
        </View>
        <PText style={styles.headerTitle}>Daily Gift</PText>
        <PText style={styles.headerSub}>{title}</PText>
      </View>
    </>
  );
}

// 내지 페이지: 문항을 단에 순서대로 채운다(한 단에 들어가면 그 단에 배치).
// 한 단을 넘는 긴 문항만 한 페이지를 쓰며, 지문은 왼쪽 단·선지는 오른쪽 단으로 나눈다.
function ContentPages({
  title,
  items,
  showAnswers,
  mode,
}: {
  title: string;
  items: ExamItemData[];
  showAnswers: boolean;
  mode: "student" | "teacher";
}) {
  const pages = planExamPages(items, mode);

  return (
    <>
      {pages.map((pg, pageIdx) => {
        if (pg.kind === "columns") {
          return (
            <Page key={pageIdx} size="A4" style={styles.contentPage}>
              <PageHeader title={title} />
              <View style={styles.columnsContainer}>
                {Array.from({ length: COLUMNS_PER_PAGE }).flatMap((_, ci) => {
                  const colItems = pg.columns[ci] ?? [];
                  const column = (
                    <View key={`c${ci}`} style={styles.column}>
                      {colItems.map((it, k) => (
                        <View
                          key={`${it.orderNum}${it.setHead ? "h" : it.passageOnly ? `p${k}` : ""}`}
                          style={{ marginBottom: k < colItems.length - 1 ? ITEM_GAP : 0 }}
                        >
                          <QuestionItem item={it} showAnswers={showAnswers} mode={mode} />
                        </View>
                      ))}
                    </View>
                  );
                  return ci === 0
                    ? [column]
                    : [<View key={`d${ci}`} style={styles.columnDivider} />, column];
                })}
              </View>
            </Page>
          );
        }

        // 한 단을 넘는 문항
        const item = pg.item;
        const parsed = parsePassage(item.question.passage, item.question.questionType);
        const hasChoices =
          parsed.type !== "writing" && parseChoices(item.question.choices).length > 0;
        const splitFits =
          hasChoices &&
          headHeight(item, parsed, COLUMN_INNER_W) <= COLUMN_HEIGHT &&
          choicesHeight(item, COLUMN_INNER_W, "선지") <= COLUMN_HEIGHT;

        if (splitFits) {
          return (
            <Page key={pageIdx} size="A4" style={styles.contentPage}>
              <PageHeader title={title} />
              <View style={styles.columnsContainer}>
                <View style={styles.column}>
                  <QuestionHead item={item} />
                </View>
                <View style={styles.columnDivider} />
                <View style={styles.column}>
                  <ChoicesBlock
                    item={item}
                    showAnswers={showAnswers}
                    header={`${item.orderNum}번 선지`}
                  />
                </View>
              </View>
            </Page>
          );
        }

        // 지문만으로 한 단을 넘는 아주 긴 문항: 페이지 전체 폭으로 이어서 출력(여러 페이지 가능)
        return (
          <Page key={pageIdx} size="A4" style={styles.contentPage}>
            <PageHeader title={title} />
            <View style={{ paddingHorizontal: 28, paddingTop: 14 }}>
              <QuestionHead item={item} />
              {hasChoices && <ChoicesBlock item={item} showAnswers={showAnswers} />}
              {parsed.type === "writing" && mode === "student" && (
                <View style={styles.writingAnswerArea}>
                  <PText style={styles.writingAnswerLabel}>답안 작성란</PText>
                </View>
              )}
            </View>
          </Page>
        );
      })}
    </>
  );
}

// choices에서 정답 번호 추출
// 본문 표시와 동일하게 normalizeMarkerChoices를 거친 뒤 인덱스를 찾아야
// 마커 전용 선지(어휘·문장삽입 등)에서 본문 정답 위치와 정답표 번호가 일치한다.
function getCorrectLabel(choicesJson: string): string {
  try {
    const raw = JSON.parse(choicesJson) as Choice[];
    const choices = normalizeMarkerChoices(raw);
    const correctIdx = choices.findIndex((c) => c.isCorrect);
    if (correctIdx >= 0) return CIRCLE_LABELS[correctIdx] || `${correctIdx + 1}`;
  } catch {
    /* empty */
  }
  return "?";
}

// 정답지 페이지
function AnswerPage({
  items,
  mode,
}: {
  items: ExamItemData[];
  mode: "student" | "teacher";
}) {
  const objectiveItems = items.filter(
    (item) => !isWritingType(item.question.questionType)
  );
  const writingItems = items.filter((item) =>
    isWritingType(item.question.questionType)
  );

  return (
    <Page size="A4" style={styles.contentPage}>
      <View style={styles.headerBar} />
      <View style={styles.headerRow}>
        <View style={styles.headerLogo}>
          <PText style={styles.headerLogoText}>T&B</PText>
        </View>
        <PText style={styles.headerTitle}>Daily Gift</PText>
        <PText style={styles.headerSub}>
          {mode === "teacher" ? "해설지" : "정답표"}
        </PText>
      </View>

      {/* 객관식 정답 그리드 */}
      <View style={styles.answerSection}>
        <PText style={styles.answerTitle}>정답</PText>
        <View style={styles.answerGrid}>
          {objectiveItems.map((item) => (
            <View key={item.orderNum} style={styles.answerCell}>
              <PText style={styles.answerNum}>{item.orderNum}</PText>
              <PText style={styles.answerVal}>
                {getCorrectLabel(item.question.choices)}
              </PText>
            </View>
          ))}
        </View>
      </View>

      {/* 해설지: 서술형 채점기준/모범답안 */}
      {mode === "teacher" && writingItems.length > 0 && (
        <View style={styles.writingAnswerSection}>
          <PText style={styles.answerTitle}>서술형 채점 기준</PText>
          {writingItems.map((item) => {
            const choices = parseChoices(item.question.choices);
            return (
              <View key={item.orderNum} style={{ marginBottom: 10 }}>
                <PText style={styles.writingAnswerTitle}>
                  {item.orderNum}번 ({item.customPoints || item.question.points}점)
                </PText>
                {choices.map((choice, i) => (
                  <PText
                    key={i}
                    style={
                      choice.isCorrect
                        ? styles.gradingTextCorrect
                        : styles.gradingText
                    }
                  >
                    {choice.text}
                  </PText>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* 해설지: 문제를 만들 때 함께 만든 해설(번호순) */}
      {mode === "teacher" && <ExplanationList items={items} />}
    </Page>
  );
}

function ExplanationList({ items }: { items: ExamItemData[] }) {
  const withText = items.filter((it) => (it.question.explanation ?? "").trim());
  if (withText.length === 0) return null;
  return (
    <View style={styles.explainSection}>
      <PText style={styles.answerTitle}>해설</PText>
      {withText.map((it) => (
        // 한 문항 해설이 쪽 경계에서 갈라지지 않게(아주 길면 react-pdf가 알아서 나눔)
        <View key={it.orderNum} style={styles.explainItem} wrap={false}>
          <PText style={styles.explainHead}>
            {it.orderNum}번{isWritingType(it.question.questionType) ? "" : `  정답 ${getCorrectLabel(it.question.choices)}`}
          </PText>
          <PText style={styles.explainText}>{(it.question.explanation ?? "").trim()}</PText>
        </View>
      ))}
    </View>
  );
}

export default function ExamPDF({
  title,
  items,
  showAnswers = false,
  mode = "student",
}: ExamPDFProps) {
  const effectiveShowAnswers = mode === "teacher" ? true : showAnswers;

  return (
    <Document>
      <CoverPage />
      <ContentPages
        title={title}
        items={items}
        showAnswers={effectiveShowAnswers}
        mode={mode}
      />
      <AnswerPage items={items} mode={mode} />
    </Document>
  );
}
