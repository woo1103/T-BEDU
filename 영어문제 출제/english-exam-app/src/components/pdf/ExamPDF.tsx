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

// 한글 폰트 등록 (Google Fonts CDN)
Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.ttf",
      fontWeight: 700,
    },
  ],
});

const BRAND_CYAN = "#4FC3F7";
const BRAND_DARK_CYAN = "#29B6F6";
const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];

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

interface ExamItemData {
  orderNum: number;
  customPoints: number | null;
  question: ExamQuestion;
}

interface ExamPDFProps {
  title: string;
  items: ExamItemData[];
  showAnswers?: boolean;
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
  // 상단 헤더바
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
    paddingHorizontal: 15,
    paddingTop: 10,
    flex: 1,
  },
  column: {
    flex: 1,
    paddingHorizontal: 8,
  },
  columnDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
  },

  // 문항
  questionBlock: {
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: 700,
    color: "#333333",
    marginRight: 4,
  },
  questionPoints: {
    fontSize: 8,
    color: "#666666",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 4,
  },
  questionText: {
    fontSize: 10,
    color: "#333333",
    fontWeight: 700,
    flex: 1,
  },
  passageBox: {
    borderWidth: 1,
    borderColor: "#D0D0D0",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
    backgroundColor: "#FAFAFA",
  },
  passageText: {
    fontSize: 9.5,
    lineHeight: 1.7,
    color: "#333333",
  },
  choiceRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 4,
  },
  choiceLabel: {
    fontSize: 9.5,
    color: "#444444",
    width: 16,
    fontWeight: 700,
  },
  choiceLabelCorrect: {
    fontSize: 9.5,
    color: "#E53935",
    width: 16,
    fontWeight: 700,
  },
  choiceText: {
    fontSize: 9.5,
    color: "#444444",
    flex: 1,
  },
  choiceTextCorrect: {
    fontSize: 9.5,
    color: "#E53935",
    fontWeight: 700,
    flex: 1,
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
});

// 표지 페이지
function CoverPage() {
  return (
    <Page size="A4" style={styles.coverPage}>
      {/* 우측 상단 장식 선 */}
      <View style={styles.coverDecoLines}>
        <Svg width={80} height={60}>
          <Line x1="20" y1="0" x2="80" y2="0" stroke={BRAND_CYAN} strokeWidth="2" />
          <Line x1="30" y1="15" x2="80" y2="15" stroke={BRAND_CYAN} strokeWidth="2" />
          <Line x1="40" y1="30" x2="80" y2="30" stroke={BRAND_CYAN} strokeWidth="1.5" />
        </Svg>
      </View>

      {/* 원형 디자인 */}
      <View style={styles.coverCircleArea}>
        <Svg width={500} height={500}>
          {/* 바깥 원 (실선) */}
          <Circle
            cx="250"
            cy="250"
            r="220"
            fill="none"
            stroke={BRAND_DARK_CYAN}
            strokeWidth="1.5"
          />
          {/* 중간 원 (굵은 반투명) */}
          <Circle
            cx="250"
            cy="250"
            r="200"
            fill="none"
            stroke={BRAND_CYAN}
            strokeWidth="8"
            opacity="0.4"
          />
          {/* 안쪽 원 (점선) */}
          <Circle
            cx="250"
            cy="250"
            r="180"
            fill="none"
            stroke={BRAND_CYAN}
            strokeWidth="1"
            strokeDasharray="8,6"
          />
        </Svg>
      </View>

      {/* Daily Gift 타이틀 - 원 안 중앙 */}
      <View style={styles.coverTitleInCircle}>
        <Text style={styles.coverTitleText}>Daily Gift</Text>
      </View>

      {/* 하단 브랜드 */}
      <View style={styles.coverBrand}>
        <Text style={styles.coverBrandText}>T&BEDU</Text>
      </View>
    </Page>
  );
}

// 문항 렌더링
function QuestionItem({
  item,
  showAnswers,
}: {
  item: ExamItemData;
  showAnswers: boolean;
}) {
  const pts = item.customPoints || item.question.points;
  let choices: Choice[] = [];
  try {
    choices = JSON.parse(item.question.choices);
  } catch {
    /* empty */
  }

  return (
    <View style={styles.questionBlock} wrap={false}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionNumber}>{item.orderNum}.</Text>
        {pts >= 3 && <Text style={styles.questionPoints}>{pts}점</Text>}
        <Text style={styles.questionText}>{item.question.question}</Text>
      </View>

      {item.question.passage && (
        <View style={styles.passageBox}>
          <Text style={styles.passageText}>{item.question.passage}</Text>
        </View>
      )}

      {choices.map((choice, i) => {
        const isCorrect = showAnswers && choice.isCorrect;
        const label = CIRCLE_LABELS[i] || `(${i + 1})`;
        return (
          <View key={i} style={styles.choiceRow}>
            <Text
              style={isCorrect ? styles.choiceLabelCorrect : styles.choiceLabel}
            >
              {label}
            </Text>
            <Text
              style={isCorrect ? styles.choiceTextCorrect : styles.choiceText}
            >
              {choice.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// 문항들을 2개씩 페어링 (1,2 / 3,4 / 5,6 ...)
function pairItems(items: ExamItemData[]): [ExamItemData | null, ExamItemData | null][] {
  const pairs: [ExamItemData | null, ExamItemData | null][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([items[i], items[i + 1] || null]);
  }
  return pairs;
}

// 내지 페이지 — 페이지당 2문제 (좌: 홀수번, 우: 짝수번)
function ContentPages({
  title,
  items,
  showAnswers,
}: {
  title: string;
  items: ExamItemData[];
  showAnswers: boolean;
}) {
  const pairs = pairItems(items);

  return (
    <>
      {pairs.map((pair, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.contentPage}>
          {/* 상단 컬러 바 */}
          <View style={styles.headerBar} />

          {/* 헤더 로우 */}
          <View style={styles.headerRow}>
            <View style={styles.headerLogo}>
              <Text style={styles.headerLogoText}>T&B</Text>
            </View>
            <Text style={styles.headerTitle}>Daily Gift</Text>
            <Text style={styles.headerSub}>{title}</Text>
          </View>

          {/* 2단 레이아웃 */}
          <View style={styles.columnsContainer}>
            <View style={styles.column}>
              {pair[0] && (
                <QuestionItem item={pair[0]} showAnswers={showAnswers} />
              )}
            </View>
            <View style={styles.columnDivider} />
            <View style={styles.column}>
              {pair[1] && (
                <QuestionItem item={pair[1]} showAnswers={showAnswers} />
              )}
            </View>
          </View>
        </Page>
      ))}
    </>
  );
}

// 정답지 페이지
function AnswerPage({ items }: { items: ExamItemData[] }) {
  return (
    <Page size="A4" style={styles.contentPage}>
      <View style={styles.headerBar} />
      <View style={styles.headerRow}>
        <View style={styles.headerLogo}>
          <Text style={styles.headerLogoText}>T&B</Text>
        </View>
        <Text style={styles.headerTitle}>Daily Gift</Text>
        <Text style={styles.headerSub}>정답표</Text>
      </View>
      <View style={styles.answerSection}>
        <Text style={styles.answerTitle}>정답</Text>
        <View style={styles.answerGrid}>
          {items.map((item) => {
            return (
              <View key={item.orderNum} style={styles.answerCell}>
                <Text style={styles.answerNum}>{item.orderNum}</Text>
                <Text style={styles.answerVal}>{item.question.answer}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </Page>
  );
}

export default function ExamPDF({ title, items, showAnswers = false }: ExamPDFProps) {
  return (
    <Document>
      <CoverPage />
      <ContentPages title={title} items={items} showAnswers={showAnswers} />
      <AnswerPage items={items} />
    </Document>
  );
}
