"use client";

// 학부모 월간 리포트(A4 한 장 = 학생 한 명). 반 전체는 한 문서에 학생마다 한 장씩.
import type { ComponentProps } from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { MonthlyReport } from "@/lib/report-format";

// 브라우저에선 /fonts URL, 테스트(Node)에선 디스크 경로
const FONT_BASE = typeof window === "undefined" ? `${process.cwd()}/public/fonts` : "/fonts";
Font.register({
  family: "NotoSansKR",
  fonts: [
    { src: `${FONT_BASE}/NotoSansKR-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_BASE}/NotoSansKR-Bold.ttf`, fontWeight: 700 },
  ],
});
Font.register({
  family: "NotoSerifKR",
  fonts: [{ src: `${FONT_BASE}/NotoSerifKR-Bold.otf`, fontWeight: 700 }],
});
Font.registerHyphenationCallback((word) => [word]);

const NO_HYPHEN_BREAK = { hyphenationPenalty: 10000 } as object;
function T(props: ComponentProps<typeof Text>) {
  return <Text {...NO_HYPHEN_BREAK} {...props} />;
}

const GREEN = "#245B3E";
const DEEP = "#1B3627";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const RED = "#C0392B";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansKR", fontSize: 9.5, color: "#1F2937", paddingHorizontal: 36, paddingTop: 30, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 10 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: DEEP, alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoText: { color: "#FFFFFF", fontFamily: "NotoSerifKR", fontWeight: 700, fontSize: 12 },
  title: { fontSize: 16, fontWeight: 700, color: DEEP },
  sub: { fontSize: 9, color: MUTED, marginTop: 2 },
  who: { marginLeft: "auto", alignItems: "flex-end" },
  name: { fontSize: 14, fontWeight: 700 },
  tiles: { flexDirection: "row", marginTop: 14, marginHorizontal: -4 },
  tile: { flex: 1, marginHorizontal: 4, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  tileLabel: { fontSize: 8, color: MUTED },
  tileValue: { fontSize: 17, fontWeight: 700, color: DEEP, marginTop: 2 },
  tileNote: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  section: { marginTop: 14 },
  h: { fontSize: 11, fontWeight: 700, color: DEEP, marginBottom: 6 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel: { width: 70, fontSize: 8.5 },
  barTrack: { flex: 1, height: 8, backgroundColor: "#F1F5F2", borderRadius: 4 },
  barValue: { width: 46, fontSize: 8.5, textAlign: "right" },
  trend: { flexDirection: "row", alignItems: "flex-end", height: 70, borderBottomWidth: 1, borderBottomColor: LINE },
  trendCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: 70 },
  trendLabels: { flexDirection: "row", marginTop: 3 },
  row: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: LINE, paddingVertical: 3 },
  cellTitle: { flex: 1, fontSize: 8.5 },
  cell: { width: 64, fontSize: 8.5, textAlign: "right" },
  comment: { borderWidth: 1, borderColor: GREEN, borderRadius: 6, padding: 10, backgroundColor: "#F5FAF7" },
  footer: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
});

const pct = (v: number | null) => (v == null ? "-" : `${v}%`);
const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

function Bar({ label, value, note, color = GREEN }: { label: string; value: number; note?: string; color?: string }) {
  return (
    <View style={s.barRow}>
      <T style={s.barLabel}>{label}</T>
      <View style={s.barTrack}>
        <View style={{ width: `${Math.max(2, Math.min(100, value))}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <T style={s.barValue}>{note ?? `${value}%`}</T>
    </View>
  );
}

function ReportPage({ r }: { r: MonthlyReport }) {
  const diff = r.accuracy.rate != null && r.accuracy.prevRate != null ? r.accuracy.rate - r.accuracy.prevRate : null;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <View style={s.logo}>
          <T style={s.logoText}>T&amp;B</T>
        </View>
        <View>
          <T style={s.title}>월간 학습 리포트</T>
          <T style={s.sub}>T&amp;BEDU · {monthLabel(r.month)}</T>
        </View>
        <View style={s.who}>
          <T style={s.name}>{r.student.name}</T>
          <T style={s.sub}>
            {r.student.grade}
            {r.student.classes.length ? ` · ${r.student.classes.join(", ")}` : ""}
          </T>
        </View>
      </View>

      <View style={s.tiles}>
        <View style={s.tile}>
          <T style={s.tileLabel}>정답률</T>
          <T style={s.tileValue}>{pct(r.accuracy.rate)}</T>
          <T style={s.tileNote}>
            {r.accuracy.total ? `${r.accuracy.correct}/${r.accuracy.total}문항` : "푼 문제 없음"}
            {diff != null ? ` · 지난달보다 ${diff >= 0 ? "+" : ""}${diff}%p` : ""}
          </T>
        </View>
        <View style={s.tile}>
          <T style={s.tileLabel}>과제 제출</T>
          <T style={s.tileValue}>{pct(r.assignments.rate)}</T>
          <T style={s.tileNote}>
            {r.assignments.assigned ? `${r.assignments.submitted}/${r.assignments.assigned}개 제출` : "이번 달 과제 없음"}
          </T>
        </View>
        <View style={s.tile}>
          <T style={s.tileLabel}>영상 강의</T>
          <T style={s.tileValue}>
            {r.videos.assigned ? `${r.videos.completed}/${r.videos.assigned}` : "-"}
          </T>
          <T style={s.tileNote}>끝까지 본 영상 · 이번 달 {r.videos.watchedThisMonth}편 시청</T>
        </View>
        <View style={s.tile}>
          <T style={s.tileLabel}>오답 복습</T>
          <T style={s.tileValue}>
            {r.wrongNotes.created ? `${r.wrongNotes.resolved}/${r.wrongNotes.created}` : "-"}
          </T>
          <T style={s.tileNote}>
            비슷한 문제 {r.wrongNotes.practiced}개 중 {r.wrongNotes.practiceCorrect}개 맞힘
          </T>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 4 }}>
        <View style={[s.section, { flex: 1, marginRight: 12 }]}>
          <T style={s.h}>최근 6개월 정답률</T>
          <View style={s.trend}>
            {r.trend.map((t) => (
              <View key={t.month} style={s.trendCol}>
                {t.rate != null && <T style={{ fontSize: 7.5, marginBottom: 2 }}>{t.rate}%</T>}
                <View
                  style={{
                    width: 18,
                    height: t.rate != null ? Math.max(2, (t.rate / 100) * 55) : 0,
                    backgroundColor: t.month === r.month ? GREEN : "#A7C4B3",
                  }}
                />
              </View>
            ))}
          </View>
          <View style={s.trendLabels}>
            {r.trend.map((t) => (
              <T key={t.month} style={{ flex: 1, fontSize: 7.5, textAlign: "center", color: MUTED }}>
                {Number(t.month.slice(5))}월
              </T>
            ))}
          </View>
        </View>

        <View style={[s.section, { flex: 1 }]}>
          <T style={s.h}>영역별 정답률</T>
          {r.areas.length === 0 ? (
            <T style={{ color: MUTED }}>이번 달 푼 문제가 적어 영역별로 나누지 않았어요.</T>
          ) : (
            r.areas.slice(0, 7).map((a) => (
              <Bar key={a.name} label={a.name} value={a.rate} color={a.rate < 60 ? RED : GREEN} note={`${a.rate}% (${a.total})`} />
            ))
          )}
          {r.weak.length > 0 && (
            <T style={{ fontSize: 8, color: RED, marginTop: 3 }}>
              보완할 영역: {r.weak.map((a) => a.name).join(", ")}
            </T>
          )}
        </View>
      </View>

      <View style={s.section}>
        <T style={s.h}>이번 달 과제</T>
        {r.assignments.list.length === 0 ? (
          <T style={{ color: MUTED }}>이번 달에 받은 과제가 없어요.</T>
        ) : (
          <>
            <View style={[s.row, { borderBottomColor: GREEN }]}>
              <T style={[s.cellTitle, { color: MUTED }]}>과제</T>
              <T style={[s.cell, { color: MUTED }]}>마감</T>
              <T style={[s.cell, { color: MUTED }]}>점수</T>
            </View>
            {r.assignments.list.slice(0, 12).map((a, i) => (
              <View key={i} style={s.row}>
                <T style={s.cellTitle}>{a.title}</T>
                <T style={s.cell}>
                  {a.dueAt ? `${new Date(a.dueAt).getMonth() + 1}/${new Date(a.dueAt).getDate()}` : "-"}
                </T>
                <T style={[s.cell, a.submitted ? {} : { color: RED }]}>
                  {a.submitted ? `${a.score}/${a.totalPoints}` : "미제출"}
                </T>
              </View>
            ))}
            {r.assignments.list.length > 12 && (
              <T style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>외 {r.assignments.list.length - 12}개</T>
            )}
          </>
        )}
      </View>

      <View style={s.section}>
        <T style={s.h}>선생님 한마디</T>
        <View style={s.comment}>
          <T style={{ lineHeight: 1.6 }}>
            {r.comments.length ? r.comments.join("\n\n") : "이번 달 코멘트가 없어요."}
          </T>
        </View>
      </View>

      <View style={s.footer} fixed>
        <T>T&amp;BEDU 영어</T>
        <T>{monthLabel(r.month)} 학습 리포트</T>
      </View>
    </Page>
  );
}

export default function ParentReportPDF({ reports }: { reports: MonthlyReport[] }) {
  return (
    <Document>
      {reports.map((r) => (
        <ReportPage key={r.student.id} r={r} />
      ))}
    </Document>
  );
}
