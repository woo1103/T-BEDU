"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMathTypes } from "@/components/math/MathTypePicker";

// 수학 유형코드표: 과정 → 단원 → 영역별 유형. 코드를 눌러 복사, 은행 문제 수를 눌러 그 유형 문제 보기.
export default function MathTypesPage() {
  const data = useMathTypes(true);
  const [courseCode, setCourseCode] = useState("");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");


  const query = q.trim();
  // 검색하면 모든 과정에서 찾는다(이름·영역·코드)
  const hits = useMemo(() => {
    if (!data || !query) return [];
    const out: { course: string; unit: string; code: string; area: string; name: string; optional?: boolean }[] = [];
    for (const c of data.courses)
      for (const u of c.units)
        for (const t of u.types)
          if (t.name.includes(query) || t.area.includes(query) || t.code.toLowerCase().startsWith(query.toLowerCase()))
            out.push({ course: c.name, unit: `${u.no}. ${u.name}`, code: t.code, area: t.area, name: t.name, optional: t.optional });
    return out;
  }, [data, query]);

  if (!data) return <div className="p-12 text-center text-gray-400">불러오는 중...</div>;

  // 처음에는 중1-1을 펼쳐 둔다
  const activeCode = courseCode || (data.courses.find((c) => c.code === "M1-1") ?? data.courses[0]).code;
  const course = data.courses.find((c) => c.code === activeCode);
  const total = data.courses.reduce((n, c) => n + c.units.reduce((k, u) => k + u.types.length, 0), 0);
  const tagged = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const levels = [...new Set(data.courses.map((c) => c.level))];

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? "" : c)), 1500);
    } catch {
      /* 복사 안 되는 환경이면 그냥 둔다 */
    }
  }

  const Count = ({ code }: { code: string }) =>
    data.counts[code] ? (
      <Link href={`/math-bank?type=${encodeURIComponent(code)}`} className="text-emerald-700 hover:underline whitespace-nowrap">
        문제 {data.counts[code]}개
      </Link>
    ) : (
      <span className="text-gray-300">-</span>
    );

  const Code = ({ code }: { code: string }) => (
    <button onClick={() => copy(code)} className="font-mono text-xs text-gray-600 hover:text-emerald-700" title="눌러서 코드 복사">
      {copied === code ? "복사됨" : code}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">수학 유형코드표</h2>
        <p className="text-sm text-gray-500 mt-1">
          2022 개정 · {data.courses.length}개 과정 · 유형 {total.toLocaleString()}개 · 은행 문제 중 유형 지정 {tagged}개. 코드는{" "}
          <span className="font-mono">과정-단원-유형</span> 순서예요(예: <span className="font-mono">M1-1-01-07</span> = 중1-1 · 1단원 · 7번 유형).
          <span className="text-gray-400"> * 는 교재·출판사에 따라 다루지 않을 수 있는 유형.</span>
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="유형 이름이나 코드로 전체 검색 (예: 최소공배수, 판별식, HC1-02)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          aria-label="유형 검색"
        />
        {!query && (
          <div className="space-y-2">
            {levels.map((lv) => (
              <div key={lv} className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-400 w-12">{lv}</span>
                {data.courses
                  .filter((c) => c.level === lv)
                  .map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCourseCode(c.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs border ${
                        c.code === activeCode ? "bg-emerald-700 text-white border-emerald-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {query ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="p-4 text-sm text-gray-600 border-b border-gray-100">
            &lsquo;{query}&rsquo; 검색 결과 {hits.length}개{hits.length > 300 && " (앞 300개만 표시)"}
          </p>
          <ul className="divide-y divide-gray-50">
            {hits.slice(0, 300).map((h) => (
              <li key={h.code} className="px-4 py-2 flex items-center gap-3 text-sm">
                <Code code={h.code} />
                <span className="text-xs text-gray-400 w-48 shrink-0 truncate" title={`${h.course} · ${h.unit} · ${h.area}`}>
                  {h.course} · {h.unit}
                </span>
                <span className="flex-1 text-gray-800">
                  {h.name}
                  {h.optional && <span className="text-gray-400"> *</span>}
                </span>
                <Count code={h.code} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        course && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {course.title} · <span className="font-mono">{course.code}</span> · 단원 {course.units.length}개
            </p>
            {course.units.map((u) => {
              const areas = [...new Set(u.types.map((t) => t.area))];
              const unitCount = u.types.reduce((n, t) => n + (data.counts[t.code] ?? 0), 0);
              return (
                <details key={u.code} className="bg-white rounded-xl shadow-sm border border-gray-100" open={course.units.length <= 3}>
                  <summary className="px-4 py-3 cursor-pointer flex items-center gap-3">
                    <span className="font-semibold text-gray-800">
                      {u.no}. {u.name}
                    </span>
                    <span className="font-mono text-xs text-gray-400">{u.code}</span>
                    <span className="text-xs text-gray-500">유형 {u.types.length}개</span>
                    {unitCount > 0 && (
                      <Link href={`/math-bank?type=${encodeURIComponent(u.code)}`} className="ml-auto text-xs text-emerald-700 hover:underline">
                        이 단원 문제 {unitCount}개
                      </Link>
                    )}
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {areas.map((area) =>
                          u.types
                            .filter((t) => t.area === area)
                            .map((t, i, arr) => (
                              <tr key={t.code} className="border-t border-gray-50">
                                {i === 0 && (
                                  <td rowSpan={arr.length} className="px-4 py-2 align-top text-xs text-gray-500 bg-gray-50 w-40">
                                    {area}
                                  </td>
                                )}
                                <td className="px-3 py-1.5 w-28">
                                  <Code code={t.code} />
                                </td>
                                <td className="px-3 py-1.5 text-gray-800">
                                  {t.no}. {t.name}
                                  {t.optional && <span className="text-gray-400"> *</span>}
                                </td>
                                <td className="px-4 py-1.5 text-right text-xs w-24">
                                  <Count code={t.code} />
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
