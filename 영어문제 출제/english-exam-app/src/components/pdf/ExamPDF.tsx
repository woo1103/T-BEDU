"use client";

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
  type OrderParsed,
  type InsertionParsed,
  type GrammarParsed,
  type SummaryParsed,
} from "@/lib/passage-parser";

// 한글 폰트 등록 — 로컬 Noto Sans KR 전체 TTF (한글·라틴·CJK 원문자 등 전 글리프 포함)
// 이전 버전은 fontsource의 korean 서브셋만 로드되어 "1." 이나 "①" 같은 글자가 깨졌음.
Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "/fonts/NotoSansKR-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "/fonts/NotoSansKR-Bold.ttf",
      fontWeight: 700,
    },
  ],
});

const BRAND_CYAN = "#4FC3F7";
const BRAND_DARK_CYAN = "#29B6F6";
const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];
const LONG_ITEM_CHARS = 900;

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
}

// __...__ 와 <u>...</u> 를 실제 밑줄 Text로 렌더링
function PassageInline({
  text,
  style,
}: {
  text: string;
  style?: ReturnType<typeof StyleSheet.create>[string];
}) {
  const normalized = normalizeUnderlineTags(text);
  const segments = splitInlineUnderline(normalized);
  return (
    <Text style={style}>
      {segments.map((seg, i) =>
        seg.underline ? (
          <Text key={i} style={{ textDecoration: "underline" }}>
            {seg.text}
          </Text>
        ) : (
          seg.text
        )
      )}
    </Text>
  );
}

interface ExamItemData {
  orderNum: number;
  customPoints: number | null;
  question: ExamQuestion;
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
        <Text style={styles.coverTitleText}>Daily Gift</Text>
      </View>
      <View style={styles.coverBrand}>
        <Text style={styles.coverBrandText}>T&BEDU</Text>
      </View>
    </Page>
  );
}

function parseChoices(choicesJson: string): Choice[] {
  try {
    return JSON.parse(choicesJson) as Choice[];
  } catch {
    return [];
  }
}

function itemCharLength(item: ExamItemData): number {
  const passageLen = item.question.passage?.length || 0;
  const choices = parseChoices(item.question.choices);
  const choicesLen = choices.reduce((s, c) => s + (c.text?.length || 0), 0);
  return passageLen + choicesLen + (item.question.question?.length || 0);
}

// ── 문제 헤더 (번호 + 배점 + 발문) ──
function QuestionHeaderRow({ item }: { item: ExamItemData }) {
  const pts = item.customPoints || item.question.points;
  return (
    <View style={styles.questionHeader}>
      <Text style={styles.questionNumber}>{item.orderNum}.</Text>
      {pts >= 3 && <Text style={styles.questionPoints}>{pts}점</Text>}
      <Text style={styles.questionText}>{item.question.question}</Text>
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
  return (
    <View style={styles.choicesBlock}>
      {header && <Text style={styles.splitChoicesHeader}>{header}</Text>}
      {choices.map((choice, i) => {
        const isCorrect = showAnswers && choice.isCorrect;
        const label = CIRCLE_LABELS[i] || `${i + 1}.`;
        return (
          <View key={i} style={styles.choiceRow}>
            <Text style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
              {label}
            </Text>
            <Text style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
              {choice.text}
            </Text>
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
        <Text style={styles.passageText}>{parsed.givenParagraph}</Text>
      </View>
      {/* (A)(B)(C) 세그먼트 */}
      {parsed.segments.map((seg, i) => (
        <View key={i} style={styles.segmentBlock}>
          <Text style={styles.passageText}>
            <Text style={styles.segmentLabel}>{seg.label} </Text>
            {seg.text}
          </Text>
        </View>
      ))}
      {/* 선지 */}
      <View style={styles.choicesBlock}>
        {choices.map((choice, i) => {
          const isCorrect = showAnswers && choice.isCorrect;
          const label = CIRCLE_LABELS[i] || `${i + 1}.`;
          return (
            <View key={i} style={styles.choiceRow}>
              <Text style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
                {label}
              </Text>
              <Text style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                {choice.text}
              </Text>
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
        <Text style={styles.passageText}>{parsed.givenSentence}</Text>
      </View>
      {/* 본문 (인라인 마커) */}
      <View style={styles.passageBox}>
        <Text style={styles.passageText}>
          {parsed.bodyParts.map((part, i) =>
            part.marker ? (
              <Text key={i} style={{ fontWeight: 700 }}>
                {" "}
                {part.marker}
                {" "}
              </Text>
            ) : (
              <Text key={i}>{part.text}</Text>
            )
          )}
        </Text>
      </View>
      {/* 선지: 문장삽입은 항상 ①~⑤ 순서 고정 (한 줄 배치) */}
      <View style={[styles.choicesBlock, { flexDirection: "row", justifyContent: "space-around", paddingTop: 4 }]}>
        {CIRCLE_LABELS.map((label, i) => {
          const choice = choices[i];
          const isCorrect = showAnswers && choice?.isCorrect;
          return (
            <Text
              key={i}
              style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}
            >
              {label}
            </Text>
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
  const choices = parseChoices(item.question.choices);

  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 지문 (밑줄+마커 포함) */}
      <View style={styles.passageBox}>
        <Text style={styles.passageText}>
          {parsed.parts.map((part, i) =>
            part.underlined ? (
              <Text key={i}>
                <Text style={styles.markerText}>{part.marker || ""}</Text>
                <Text style={styles.underlinedText}>{part.underlined}</Text>
              </Text>
            ) : (
              <Text key={i}>{part.text}</Text>
            )
          )}
        </Text>
      </View>
      {/* 선지 */}
      <View style={styles.choicesBlock}>
        {choices.map((choice, i) => {
          const isCorrect = showAnswers && choice.isCorrect;
          const label = CIRCLE_LABELS[i] || `${i + 1}.`;
          return (
            <View key={i} style={styles.choiceRow}>
              <Text style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
                {label}
              </Text>
              <Text style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                {choice.text}
              </Text>
            </View>
          );
        })}
      </View>
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
    const match = c.text.match(
      /\(A\)\s*(\S+)\s*[…·\-—]+\s*\(B\)\s*(\S+)/
    );
    return {
      a: match ? match[1] : c.text,
      b: match ? match[2] : "",
      isCorrect: c.isCorrect,
    };
  });

  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {/* 본문 박스 */}
      <View style={styles.passageBox}>
        <Text style={styles.passageText}>{parsed.mainPassage}</Text>
      </View>
      {/* 화살표 */}
      <Text style={styles.summaryArrow}>▼</Text>
      {/* 요약문 박스 */}
      <View style={styles.passageBox}>
        <Text style={styles.passageText}>{parsed.summaryText}</Text>
      </View>
      {/* (A)/(B) 선지 표 */}
      <View style={styles.summaryChoiceTable}>
        {/* (A) 열 */}
        <View style={styles.summaryChoiceColumn}>
          <Text style={styles.summaryChoiceHeader}>(A)</Text>
          {parsedChoices.map((c, i) => {
            const isCorrect = showAnswers && c.isCorrect;
            const label = CIRCLE_LABELS[i] || `${i + 1}.`;
            return (
              <View key={i} style={styles.summaryChoiceRow}>
                <Text style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}>
                  {label}
                </Text>
                <Text style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                  {c.a}
                </Text>
              </View>
            );
          })}
        </View>
        {/* 구분점 열 */}
        <View style={{ justifyContent: "center", paddingTop: 16 }}>
          {parsedChoices.map((_, i) => (
            <Text
              key={i}
              style={{ fontSize: 8, color: "#999999", marginBottom: 3, textAlign: "center" }}
            >
              ……
            </Text>
          ))}
        </View>
        {/* (B) 열 */}
        <View style={styles.summaryChoiceColumn}>
          <Text style={styles.summaryChoiceHeader}>(B)</Text>
          {parsedChoices.map((c, i) => {
            const isCorrect = showAnswers && c.isCorrect;
            return (
              <View key={i} style={styles.summaryChoiceRow}>
                <Text style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}>
                  {c.b}
                </Text>
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
          <Text style={styles.writingAnswerLabel}>답안 작성란</Text>
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
  return (
    <View wrap={false}>
      <QuestionHeaderRow item={item} />
      {item.question.passage && (
        <View style={styles.passageBox}>
          <PassageInline text={item.question.passage} style={styles.passageText} />
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
            <Text style={styles.passageText}>{parsed.givenParagraph}</Text>
          </View>
          {parsed.segments.map((seg, i) => (
            <View key={i} style={styles.segmentBlock}>
              <Text style={styles.passageText}>
                <Text style={styles.segmentLabel}>{seg.label} </Text>
                {seg.text}
              </Text>
            </View>
          ))}
        </>
      )}

      {parsed.type === "insertion" && (
        <>
          <View style={styles.givenBox}>
            <Text style={styles.passageText}>{parsed.givenSentence}</Text>
          </View>
          <View style={styles.passageBox}>
            <Text style={styles.passageText}>
              {parsed.bodyParts.map((part, i) =>
                part.marker ? (
                  <Text key={i} style={{ fontWeight: 700 }}>
                    {" "}{part.marker}{" "}
                  </Text>
                ) : (
                  <Text key={i}>{part.text}</Text>
                )
              )}
            </Text>
          </View>
        </>
      )}

      {parsed.type === "grammar" && (
        <View style={styles.passageBox}>
          <Text style={styles.passageText}>
            {parsed.parts.map((part, i) =>
              part.underlined ? (
                <Text key={i}>
                  <Text style={styles.markerText}>{part.marker || ""}</Text>
                  <Text style={styles.underlinedText}>{part.underlined}</Text>
                </Text>
              ) : (
                <Text key={i}>{part.text}</Text>
              )
            )}
          </Text>
        </View>
      )}

      {parsed.type === "summary" && (
        <>
          <View style={styles.passageBox}>
            <Text style={styles.passageText}>{parsed.mainPassage}</Text>
          </View>
          <Text style={styles.summaryArrow}>▼</Text>
          <View style={styles.passageBox}>
            <Text style={styles.passageText}>{parsed.summaryText}</Text>
          </View>
        </>
      )}

      {(parsed.type === "default" || parsed.type === "writing") && item.question.passage && (
        <View style={styles.passageBox}>
          <PassageInline
            text={parsed.type === "default" ? parsed.text : item.question.passage}
            style={styles.passageText}
          />
        </View>
      )}
    </View>
  );
}

// 페이지 레이아웃
type PageLayout =
  | { mode: "pair"; left: ExamItemData; right: ExamItemData | null }
  | { mode: "split"; item: ExamItemData };

function layoutPages(items: ExamItemData[]): PageLayout[] {
  const pages: PageLayout[] = [];
  let i = 0;
  while (i < items.length) {
    const a = items[i];
    // 서술형은 선지가 없으므로 split 레이아웃을 쓰지 않음
    const aIsWriting = isWritingType(a.question.questionType);
    if (!aIsWriting && itemCharLength(a) > LONG_ITEM_CHARS) {
      pages.push({ mode: "split", item: a });
      i += 1;
      continue;
    }
    const b = items[i + 1];
    if (b && itemCharLength(b) <= LONG_ITEM_CHARS) {
      pages.push({ mode: "pair", left: a, right: b });
      i += 2;
    } else {
      pages.push({ mode: "pair", left: a, right: null });
      i += 1;
    }
  }
  return pages;
}

// 내지 페이지
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
  const pages = layoutPages(items);

  return (
    <>
      {pages.map((pg, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.contentPage}>
          <View style={styles.headerBar} />
          <View style={styles.headerRow}>
            <View style={styles.headerLogo}>
              <Text style={styles.headerLogoText}>T&B</Text>
            </View>
            <Text style={styles.headerTitle}>Daily Gift</Text>
            <Text style={styles.headerSub}>{title}</Text>
          </View>

          <View style={styles.columnsContainer}>
            {pg.mode === "pair" ? (
              <>
                <View style={styles.column}>
                  <QuestionItem item={pg.left} showAnswers={showAnswers} mode={mode} />
                </View>
                <View style={styles.columnDivider} />
                <View style={styles.column}>
                  {pg.right && (
                    <QuestionItem item={pg.right} showAnswers={showAnswers} mode={mode} />
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.column}>
                  <QuestionHead item={pg.item} />
                </View>
                <View style={styles.columnDivider} />
                <View style={styles.column}>
                  <ChoicesBlock
                    item={pg.item}
                    showAnswers={showAnswers}
                    header={`${pg.item.orderNum}번 선지`}
                  />
                </View>
              </>
            )}
          </View>
        </Page>
      ))}
    </>
  );
}

// choices에서 정답 번호 추출
function getCorrectLabel(choicesJson: string): string {
  try {
    const choices: Choice[] = JSON.parse(choicesJson);
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
          <Text style={styles.headerLogoText}>T&B</Text>
        </View>
        <Text style={styles.headerTitle}>Daily Gift</Text>
        <Text style={styles.headerSub}>
          {mode === "teacher" ? "해설지" : "정답표"}
        </Text>
      </View>

      {/* 객관식 정답 그리드 */}
      <View style={styles.answerSection}>
        <Text style={styles.answerTitle}>정답</Text>
        <View style={styles.answerGrid}>
          {objectiveItems.map((item) => (
            <View key={item.orderNum} style={styles.answerCell}>
              <Text style={styles.answerNum}>{item.orderNum}</Text>
              <Text style={styles.answerVal}>
                {getCorrectLabel(item.question.choices)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 해설지: 서술형 채점기준/모범답안 */}
      {mode === "teacher" && writingItems.length > 0 && (
        <View style={styles.writingAnswerSection}>
          <Text style={styles.answerTitle}>서술형 채점 기준</Text>
          {writingItems.map((item) => {
            const choices = parseChoices(item.question.choices);
            return (
              <View key={item.orderNum} style={{ marginBottom: 10 }}>
                <Text style={styles.writingAnswerTitle}>
                  {item.orderNum}번 ({item.customPoints || item.question.points}점)
                </Text>
                {choices.map((choice, i) => (
                  <Text
                    key={i}
                    style={
                      choice.isCorrect
                        ? styles.gradingTextCorrect
                        : styles.gradingText
                    }
                  >
                    {choice.text}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </Page>
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
