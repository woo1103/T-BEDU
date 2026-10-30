// 도표(25번) 그래프 — 화면용 SVG. 학생 앱(student-app/src/components/ChartView.tsx)에 같은 파일을 복사해 쓴다.
import type { ChartSpec } from "../lib/passage-parser";
import { layoutChart, SERIES_FILL, formatChartValue, wrapLabel } from "../lib/chart-layout";

export default function ChartView({ chart }: { chart: ChartSpec }) {
  const L = layoutChart(chart);
  const stroke = "#333";
  return (
    <figure className="my-3">
      <svg viewBox={`0 0 ${L.width} ${L.height}`} className="w-full max-w-xl mx-auto block" role="img" aria-label={chart.title}>
        <text x={L.width / 2} y={14} textAnchor="middle" fontSize={13} fontWeight={700} fill={stroke}>
          {chart.title}
        </text>
        {chart.unit && (
          <text x={L.plot.left - 6} y={L.plot.top - 8} textAnchor="end" fontSize={10} fill="#555">
            ({chart.unit})
          </text>
        )}
        {L.yTicks.map((t) => (
          <g key={t.value}>
            <line x1={L.plot.left} x2={L.plot.right} y1={t.y} y2={t.y} stroke="#ddd" strokeWidth={0.8} />
            <text x={L.plot.left - 6} y={t.y + 3.5} textAnchor="end" fontSize={10} fill="#555">
              {t.label}
            </text>
          </g>
        ))}
        <line x1={L.plot.left} x2={L.plot.left} y1={L.plot.top} y2={L.plot.bottom} stroke={stroke} strokeWidth={1} />
        <line x1={L.plot.left} x2={L.plot.right} y1={L.plot.bottom} y2={L.plot.bottom} stroke={stroke} strokeWidth={1} />
        {L.bars.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={SERIES_FILL[b.series]} stroke={stroke} strokeWidth={0.6} />
            <text x={b.x + b.w / 2} y={b.y - 3} textAnchor="middle" fontSize={9} fill={stroke}>
              {formatChartValue(b.value)}
            </text>
          </g>
        ))}
        {L.lines.map((ln) => (
          <g key={ln.series}>
            <polyline
              points={ln.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={SERIES_FILL[ln.series] === "#D9DEE2" ? "#888" : SERIES_FILL[ln.series]}
              strokeWidth={2}
              strokeDasharray={ln.series === 1 ? "6 3" : undefined}
            />
            {ln.points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3} fill="#fff" stroke={stroke} strokeWidth={1} />
                <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={9} fill={stroke}>
                  {formatChartValue(p.value)}
                </text>
              </g>
            ))}
          </g>
        ))}
        {L.categories.map((c) =>
          wrapLabel(c.label).map((line, k) => (
            <text key={c.label + k} x={c.x} y={L.plot.bottom + 14 + k * 12} textAnchor="middle" fontSize={10} fill={stroke}>
              {line}
            </text>
          ))
        )}
      </svg>
      {L.legend.length > 1 && (
        <figcaption className="flex justify-center gap-4 text-xs text-gray-600 mt-1">
          {L.legend.map((g) => (
            <span key={g.series} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 border border-gray-500"
                style={{ background: SERIES_FILL[g.series] }}
              />
              {g.name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
