"use client";

import { useEffect, useState } from "react";
import { KRW_PER_USD, type KindSummary } from "@/lib/ai-cost";

interface Summary {
  byKind: KindSummary[];
  calls: number;
  usd: number;
}

interface UsageData {
  month: string;
  thisMonth: Summary;
  lastMonth: Summary;
  projectedUsd: number;
  daily: { date: string; usd: number }[];
}

const won = (usd: number) => `약 ${Math.round(usd * KRW_PER_USD).toLocaleString()}원`;
const dollar = (usd: number) => `$${usd.toFixed(2)}`;

// 관리자: AI 호출 횟수와 어림 비용
export default function AiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/ai-usage")
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "불러오지 못했어요.");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, []);

  const maxDay = Math.max(0.0001, ...(data?.daily.map((d) => d.usd) ?? [0]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 사용량</h1>
        <p className="text-sm text-gray-500 mt-1">
          문제 만들기·검수·채점·인식에 쓴 AI 비용을 어림해 보여줍니다(환율 {KRW_PER_USD.toLocaleString()}원 기준, 실제 청구액과 조금 다를 수 있어요).
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-400">불러오는 중...</p>}

      {data && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card title={`이번 달(${data.month})`} main={won(data.thisMonth.usd)} sub={`${dollar(data.thisMonth.usd)} · ${data.thisMonth.calls.toLocaleString()}회`} />
            <Card title="이번 달 예상" main={won(data.projectedUsd)} sub="지금까지 하루 평균으로 계산" />
            <Card title="지난달" main={won(data.lastMonth.usd)} sub={`${dollar(data.lastMonth.usd)} · ${data.lastMonth.calls.toLocaleString()}회`} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">이번 달 쓰임새</h2>
            {data.thisMonth.byKind.length === 0 ? (
              <p className="text-sm text-gray-400">이번 달에는 아직 AI를 쓰지 않았어요.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 font-medium">작업</th>
                    <th className="py-2 font-medium text-right">횟수</th>
                    <th className="py-2 font-medium text-right">1회 평균</th>
                    <th className="py-2 font-medium text-right">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thisMonth.byKind.map((k) => (
                    <tr key={k.kind} className="border-b border-gray-50">
                      <td className="py-2">{k.label}</td>
                      <td className="py-2 text-right">{k.calls.toLocaleString()}</td>
                      <td className="py-2 text-right">{won(k.usd / k.calls)}</td>
                      <td className="py-2 text-right font-medium">{won(k.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {data.daily.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">날짜별</h2>
              <ul className="space-y-1.5">
                {data.daily.map((d) => (
                  <li key={d.date} className="flex items-center gap-3 text-sm">
                    <span className="w-14 text-gray-500">{d.date.slice(5)}</span>
                    <span className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                      <span className="block h-full bg-emerald-600" style={{ width: `${(d.usd / maxDay) * 100}%` }} />
                    </span>
                    <span className="w-28 text-right">{won(d.usd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ title, main, sub }: { title: string; main: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{main}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
