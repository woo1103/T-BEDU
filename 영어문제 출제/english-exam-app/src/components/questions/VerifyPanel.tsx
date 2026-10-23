"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Stats {
  total: number;
  ok: number;
  suspect: number;
  error: number;
  unverified: number;
  unverifiedInExam: number;
}

type Scope = "inExam" | "all" | "errors";

// 문제은행 상단: 기존 문항 독립 풀이 재검수 (진행률·중단·의심 문항 바로가기)
export default function VerifyPanel({
  onProgress,
  onShowSuspect,
}: {
  onProgress: () => void; // 검수가 끝나거나 멈췄을 때 목록 갱신
  onShowSuspect: () => void; // "의심 문항 보기"
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState<Scope | null>(null);
  const [done, setDone] = useState(0);
  const [target, setTarget] = useState(0);
  const [foundSuspect, setFoundSuspect] = useState(0);
  const [message, setMessage] = useState("");
  const stopRef = useRef(false);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/questions/verify");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function run(scope: Scope) {
    if (!stats) return;
    const total = scope === "inExam" ? stats.unverifiedInExam : scope === "errors" ? stats.error : stats.unverified;
    if (total === 0) return;
    stopRef.current = false;
    setRunning(scope);
    setDone(0);
    setTarget(total);
    setFoundSuspect(0);
    setMessage("");
    let processed = 0;
    let suspects = 0;
    try {
      while (!stopRef.current) {
        const res = await fetch("/api/questions/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, batch: 4 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `서버 응답 ${res.status}`);
        const results = data.results as { status: string }[];
        setStats(data.stats);
        if (results.length === 0) break;
        processed += results.length;
        suspects += results.filter((r) => r.status === "suspect").length;
        setDone(processed);
        setFoundSuspect(suspects);
        // 한 묶음이 전부 호출 실패면(AI 서비스 문제 등) 같은 문항을 계속 고르지 않도록 멈춘다
        if (results.every((r) => r.status === "error")) {
          setMessage("검수 호출이 연달아 실패해 멈췄습니다. 잠시 뒤 '실패한 문항 다시 검수'를 눌러 주세요.");
          break;
        }
        if (processed >= total) break;
      }
      if (stopRef.current) setMessage(`${processed}개 검수 후 멈췄습니다. 다시 누르면 이어서 검수합니다.`);
    } catch (e) {
      setMessage(`검수 중 오류: ${e instanceof Error ? e.message : "알 수 없음"}`);
    } finally {
      setRunning(null);
      await loadStats();
      onProgress();
    }
  }

  if (!stats) return null;
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;
  const btn = "text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-sm font-bold text-gray-800">🔍 문제 검수</h2>
        <span className="text-xs text-gray-500">
          객관식 {stats.total}개 · <span className="text-emerald-700">통과 {stats.ok}</span> ·{" "}
          <span className="text-amber-700">의심 {stats.suspect}</span> · 미검수 {stats.unverified}
          {stats.error > 0 && <span className="text-red-600"> · 검수 실패 {stats.error}</span>}
        </span>
        {stats.suspect > 0 && (
          <button onClick={onShowSuspect} className="text-xs text-amber-700 underline underline-offset-2">
            의심 문항 보기
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        AI가 정답을 모르는 상태로 문제를 풀어 보고, 출제 정답과 다르거나 맞는 답이 없거나 둘 이상이면 ‘의심’으로 표시합니다.
        문제 1개당 AI 호출 1번이 들어갑니다.
      </p>

      {running ? (
        <div className="space-y-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct}>
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>
              {done} / {target} 검수 중 · 의심 {foundSuspect}개 발견
            </span>
            <button
              onClick={() => (stopRef.current = true)}
              className={`${btn} border-gray-300 text-gray-700 hover:bg-gray-50`}
            >
              멈추기
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run("inExam")}
            disabled={stats.unverifiedInExam === 0}
            className={`${btn} bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800`}
          >
            시험지에 들어간 문제 검수 ({stats.unverifiedInExam})
          </button>
          <button
            onClick={() => run("all")}
            disabled={stats.unverified === 0}
            className={`${btn} border-emerald-700 text-emerald-800 hover:bg-emerald-50`}
          >
            미검수 전체 검수 ({stats.unverified})
          </button>
          {stats.error > 0 && (
            <button onClick={() => run("errors")} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>
              실패한 문항 다시 검수 ({stats.error})
            </button>
          )}
        </div>
      )}
      {message && <p className="text-xs text-gray-700">{message}</p>}
    </div>
  );
}
