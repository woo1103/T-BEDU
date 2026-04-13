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
// 원문자(①②③④⑤)는 한글 폰트 서브셋에 빠져 PDF에서 a,b,c,d로 렌더되는 이슈가 있어
// 일반 숫자로 대체.
const CIRCLE_LABELS = ["1.", "2.", "3.", "4.", "5."];
// 긴 문제 판별 임계값: passage 글자 + 모든 choice 글자 합
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

function parseChoices(choicesJson: string): Choice[] {
  try {
    return JSON.parse(choicesJson) as Choice[];
  } catch {
    return [];
  }
}

// 문제 길이(문자 수) 계산 — split 모드 판단용
function itemCharLength(item: ExamItemData): number {
  const passageLen = item.question.passage?.length || 0;
  const choices = parseChoices(item.question.choices);
  const choicesLen = choices.reduce((s, c) => s + (c.text?.length || 0), 0);
  return passageLen + choicesLen + (item.question.question?.length || 0);
}

// 문제 헤더 + 지문 (선지는 포함하지 않음)
function QuestionHead({ item }: { item: ExamItemData }) {
  const pts = item.customPoints || item.question.points;
  return (
    <View style={styles.questionBlock}>
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
    </View>
  );
}

// 선지만 렌더링
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

// 일반(컴팩트) 모드: 좌우 한 문제씩 — 헤더+지문+선지 전부 포함
function QuestionItem({
  item,
  showAnswers,
}: {
  item: ExamItemData;
  showAnswers: boolean;
}) {
  return (
    <View wrap={false}>
      <QuestionHead item={item} />
      <ChoicesBlock item={item} showAnswers={showAnswers} />
    </View>
  );
}

// 페이지 구성: long 아이템은 스플릿 페이지, 아니면 2개씩 페어 페이지
type PageLayout =
  | { mode: "pair"; left: ExamItemData; right: ExamItemData | null }
  | { mode: "split"; item: ExamItemData };

function layoutPages(items: ExamItemData[]): PageLayout[] {
  const pages: PageLayout[] = [];
  let i = 0;
  while (i < items.length) {
    const a = items[i];
    if (itemCharLength(a) > LONG_ITEM_CHARS) {
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
}: {
  title: string;
  items: ExamItemData[];
  showAnswers: boolean;
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
                  <QuestionItem item={pg.left} showAnswers={showAnswers} />
                </View>
                <View style={styles.columnDivider} />
                <View style={styles.column}>
                  {pg.right && (
                    <QuestionItem item={pg.right} showAnswers={showAnswers} />
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

// choices에서 정답 번호(①②③④⑤) 추출
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
                <Text style={styles.answerVal}>
                  {getCorrectLabel(item.question.choices)}
                </Text>
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
