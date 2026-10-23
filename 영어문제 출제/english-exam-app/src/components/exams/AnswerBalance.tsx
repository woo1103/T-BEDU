"use client";

import { useCallback, useEffect, useState } from "react";

const LABELS = ["①", "②", "③", "④", "⑤"];

interface Summary {
  distribution: number[];
  skewed: boolean;
  movableCount: number;
  assigned: boolean;
  total: number;
}

// 시험지 정답 번호 분포 + 고르게 섞기 (인쇄 시 숨김)
export default function AnswerBalance({ examId, onChanged }: { examId: string; onChanged: () => void }) {
  const [s, setS] = useState<Summary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}/balance-answers`);
    if (res.ok) setS(await res.json());
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  async function balance() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/exams/${examId}/balance-answers`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "섞기 실패");
      setS(data);
      setMessage(data.changed > 0 ? `${data.changed}문항의 선지 순서를 바꿨습니다.` : "더 바꿀 수 있는 문항이 없습니다.");
      if (data.changed > 0) onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!s || s.total === 0) return null;
  const max = Math.max(...s.distribution, 1);
  const top = s.distribution.indexOf(Math.max(...s.distribution));

  return (
    <div className="print:hidden bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-sm font-bold text-gray-800">정답 번호 분포</h2>
        <span className={`text-xs ${s.skewed ? "text-amber-700" : "text-emerald-700"}`}>
          {s.skewed ? `정답이 ${LABELS[top]}에 몰려 있어요.` : "고르게 퍼져 있어요."}
        </span>
      </div>

      <div className="flex items-end gap-3 h-20" aria-label="정답 번호별 문항 수">
        {s.distribution.map((n, i) => (
          <div key={i} className="flex flex-col items-center justify-end gap-1 w-10 h-full">
            <span className="text-xs text-gray-600 tabular-nums">{n}</span>
            <div
              className={`w-full rounded-t ${i === top && s.skewed ? "bg-amber-500" : "bg-emerald-600"}`}
              style={{ height: `${(n / max) * 100}%`, minHeight: n > 0 ? 4 : 0 }}
            />
            <span className="text-xs text-gray-700">{LABELS[i]}</span>
          </div>
        ))}
      </div>

      {s.skewed &&
        (s.assigned ? (
          <p className="text-xs text-gray-500">
            이미 학생에게 배정된 시험지라 선지 순서는 바꿀 수 없어요. 문항을 다른 문제로 바꿔 조정해 주세요.
          </p>
        ) : s.movableCount === 0 ? (
          <p className="text-xs text-gray-500">
            바꿀 수 있는 문항이 없어요(다른 시험지에도 쓰인 문항이거나, 선지가 지문 번호와 연결된 어법·순서·삽입 유형).
          </p>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-700">
              이 시험지에만 쓰인 {s.movableCount}문항 중 필요한 만큼 정답 선지와 다른 선지의 자리를 맞바꿉니다. 진행할까요?
            </span>
            <button
              onClick={balance}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? "섞는 중..." : "네, 섞기"}
            </button>
            <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg border border-gray-300">
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-700 text-emerald-800 hover:bg-emerald-50"
          >
            고르게 섞기 (바꿀 수 있는 문항 {s.movableCount}개)
          </button>
        ))}
      {message && <p className="text-xs text-gray-700">{message}</p>}
    </div>
  );
}
