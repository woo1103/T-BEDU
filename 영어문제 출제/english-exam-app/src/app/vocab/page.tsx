"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SetRow {
  id: string;
  title: string;
  grade: string | null;
  description: string | null;
  createdAt: string;
  wordCount: number;
  classes: { id: string; name: string }[];
}

// 단어 세트 목록: 세트를 만들고(엑셀·PDF·붙여 넣기) 반에 배정하면 학생 앱에서 외운다
export default function VocabListPage() {
  const [sets, setSets] = useState<SetRow[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/vocab-sets");
    const d = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(d)) {
      setError(d?.error || `단어 세트를 불러오지 못했어요 (${res.status})`);
      setSets([]);
      return;
    }
    setSets(d);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버에서 불러온 뒤 상태를 채운다
    load();
  }, []);

  async function remove(s: SetRow) {
    if (!confirm(`"${s.title}" 세트를 지울까요?\n단어 ${s.wordCount}개와 학생들의 학습 기록도 함께 지워지고 되돌릴 수 없어요.`)) return;
    const res = await fetch(`/api/vocab-sets/${s.id}`, { method: "DELETE" });
    if (!res.ok) alert("삭제 실패");
    await load();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">단어 학습</h2>
          <p className="text-sm text-gray-500 mt-1">
            단어 세트를 만들어 반에 배정하면 학생 앱에서 카드·뜻 고르기로 외워요. 세트에서 범위를 골라 단어 시험지도 인쇄할 수 있어요.
          </p>
        </div>
        <Link href="/vocab/new" className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800">
          + 새 단어 세트
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {sets === null ? (
          <p className="p-6 text-sm text-gray-400">불러오는 중...</p>
        ) : sets.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">아직 단어 세트가 없어요. 오른쪽 위 &quot;새 단어 세트&quot;로 만들어 보세요.</p>
        ) : (
          sets.map((s) => (
            <div key={s.id} className="p-4 flex items-center gap-3 flex-wrap">
              <Link href={`/vocab/${s.id}`} className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {s.title}
                  {s.grade && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{s.grade}</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  단어 {s.wordCount}개 · {s.classes.length ? `배정: ${s.classes.map((c) => c.name).join(", ")}` : "아직 배정 안 함"}
                </p>
              </Link>
              <Link href={`/vocab/${s.id}#print`} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                시험지 만들기
              </Link>
              <button onClick={() => remove(s)} className="text-xs text-red-400 hover:text-red-600">
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
