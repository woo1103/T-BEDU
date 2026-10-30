// 도표(25번) 그래프 — 시험지 PDF용(react-pdf Svg). 좌표는 화면용 ChartView와 같은 layoutChart.
import { Svg, Rect, Line, Polyline, Circle, Text, View } from "@react-pdf/renderer";
import type { ChartSpec } from "@/lib/passage-parser";
import { layoutChart, SERIES_FILL, formatChartValue, wrapLabel } from "@/lib/chart-layout";

const BASE_W = 520;
const BASE_H = 300;
const LEGEND_H = 14;

// 폭 width로 그렸을 때 차지하는 높이(단 배치 계산용)
export function chartPdfHeight(chart: ChartSpec | null, width: number): number {
  if (!chart) return 0;
  return (width * BASE_H) / BASE_W + (chart.series.length > 1 ? LEGEND_H : 0) + 8;
}

export default function ChartPDF({ chart, width, fontFamily }: { chart: ChartSpec; width: number; fontFamily?: string }) {
  const L = layoutChart(chart, BASE_W, BASE_H);
  const height = (width * BASE_H) / BASE_W;
  const ink = "#222222";
  const t = (size: number, weight?: number) => ({ fontSize: size, fontFamily, fontWeight: weight });
  return (
    <View style={{ marginBottom: 8 }} wrap={false}>
      <Svg width={width} height={height} viewBox={`0 0 ${BASE_W} ${BASE_H}`}>
        <Text x={BASE_W / 2} y={14} textAnchor="middle" fill={ink} style={t(13, 700)}>
          {chart.title}
        </Text>
        {chart.unit ? (
          <Text x={L.plot.left - 6} y={L.plot.top - 8} textAnchor="end" fill="#555555" style={t(10)}>
            {`(${chart.unit})`}
          </Text>
        ) : null}
        {L.yTicks.map((tk) => (
          <Line key={`g${tk.value}`} x1={L.plot.left} x2={L.plot.right} y1={tk.y} y2={tk.y} stroke="#DDDDDD" strokeWidth={0.8} />
        ))}
        {L.yTicks.map((tk) => (
          <Text key={`y${tk.value}`} x={L.plot.left - 6} y={tk.y + 3.5} textAnchor="end" fill="#555555" style={t(10)}>
            {tk.label}
          </Text>
        ))}
        <Line x1={L.plot.left} x2={L.plot.left} y1={L.plot.top} y2={L.plot.bottom} stroke={ink} strokeWidth={1} />
        <Line x1={L.plot.left} x2={L.plot.right} y1={L.plot.bottom} y2={L.plot.bottom} stroke={ink} strokeWidth={1} />
        {L.bars.map((b, i) => (
          <Rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={SERIES_FILL[b.series]} stroke={ink} strokeWidth={0.6} />
        ))}
        {L.bars.map((b, i) => (
          <Text key={`bv${i}`} x={b.x + b.w / 2} y={b.y - 3} textAnchor="middle" fill={ink} style={t(9)}>
            {formatChartValue(b.value)}
          </Text>
        ))}
        {L.lines.map((ln) => (
          <Polyline
            key={`l${ln.series}`}
            points={ln.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={ln.series === 0 ? "#2F4858" : "#888888"}
            strokeWidth={2}
            strokeDasharray={ln.series === 1 ? "6 3" : undefined}
          />
        ))}
        {L.lines.flatMap((ln) =>
          ln.points.map((p, i) => (
            <Circle key={`c${ln.series}-${i}`} cx={p.x} cy={p.y} r={3} fill="#FFFFFF" stroke={ink} strokeWidth={1} />
          ))
        )}
        {L.lines.flatMap((ln) =>
          ln.points.map((p, i) => (
            <Text key={`lv${ln.series}-${i}`} x={p.x} y={p.y - 7} textAnchor="middle" fill={ink} style={t(9)}>
              {formatChartValue(p.value)}
            </Text>
          ))
        )}
        {L.categories.flatMap((c) =>
          wrapLabel(c.label).map((line, k) => (
            <Text key={`x${c.label}${k}`} x={c.x} y={L.plot.bottom + 14 + k * 12} textAnchor="middle" fill={ink} style={t(10)}>
              {line}
            </Text>
          ))
        )}
      </Svg>
      {L.legend.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", height: LEGEND_H, alignItems: "center" }}>
          {L.legend.map((g) => (
            <View key={g.series} style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: chart.type === "bar" ? SERIES_FILL[g.series] : g.series === 0 ? "#2F4858" : "#888888",
                  borderWidth: 0.5,
                  borderColor: "#555555",
                  marginRight: 3,
                }}
              />
              <Text style={{ fontSize: 8, fontFamily }}>{g.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
