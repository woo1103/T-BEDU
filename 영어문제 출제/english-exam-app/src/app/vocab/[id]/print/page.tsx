"use client";

import { use, useEffect, useMemo, useState } from "react";
import { seededShuffle } from "@/lib/vocab";

interface Word {
  id: string;
  order: number;
  part: number;
  word: string;
  meaning: string;
}

// 단어 시험지(영어 → 뜻 쓰기) 인쇄 화면. ?from=&to=&count=&shuffle=1&seed=&key=1
export default function VocabPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = use(params);
  const sp = use(searchParams);
  const [title, setTitle] = useState("");
  const [words, setWords] = useState<Word[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/vocab-sets/${id}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d) throw new Error(d?.error || "세트를 불러오지 못했어요");
        setTitle(d.title);
        setWords(d.words);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const items = useMemo(() => {
    if (!words) return [];
    const from = Math.max(1, Number(sp.from) || 1);
    const to = Math.max(from, Number(sp.to) || words.length);
    // 범위(partFrom~partTo)로 고르면 범위 번호로, 아니면 단어 번호(from~to)로
    const pf = Number(sp.partFrom) || 0;
    const pt = Math.max(pf, Number(sp.partTo) || pf);
    let list = pf ? words.filter((w) => (w.part ?? 1) >= pf && (w.part ?? 1) <= pt) : words.filter((w) => w.order >= from && w.order <= to);
    const seed = Number(sp.seed) || 1;
    if (sp.shuffle === "1") list = seededShuffle(list, seed);
    const count = Number(sp.count) || 0;
    if (count > 0 && count < list.length) {
      // 섞지 않았어도 문항 수만큼 고를 때는 범위 안에서 고르게 뽑는다
      list = sp.shuffle === "1" ? list.slice(0, count) : seededShuffle(list, seed + 7).slice(0, count).sort((a, b) => a.order - b.order);
    }
    return list;
  }, [words, sp.from, sp.to, sp.partFrom, sp.partTo, sp.shuffle, sp.seed, sp.count]);

  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (!words) return <p className="p-8 text-gray-400">불러오는 중...</p>;

  const pf = Number(sp.partFrom) || 0;
  const pt = Math.max(pf, Number(sp.partTo) || pf);
  const range = pf ? (pf === pt ? `범위 ${pf}` : `범위 ${pf}~${pt}`) : `${Math.max(1, Number(sp.from) || 1)}~${Number(sp.to) || words.length}번`;
  const half = Math.ceil(items.length / 2);
  const cols = [items.slice(0, half), items.slice(half)];

  const sheet = (answer: boolean) => (
    <section className={`vocab-sheet bg-white mx-auto ${answer ? "break-before-page" : ""}`}>
      <div className="border-b-2 border-black pb-2 mb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{title} {answer ? "· 정답" : "· 단어 시험"}</h1>
            <p className="text-xs text-gray-600 mt-0.5">{range} · {items.length}문항 · 영어 단어의 뜻을 쓰시오.</p>
          </div>
          {!answer && (
            <div className="text-sm flex gap-4 whitespace-nowrap">
              <span>반 ______</span>
              <span>이름 __________</span>
              <span>점수 ____ / {items.length}</span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8">
        {cols.map((col, ci) => (
          <ol key={ci} className="space-y-0">
            {col.map((w, i) => {
              const n = ci * half + i + 1;
              return (
                <li key={w.id} className="flex items-end gap-2 py-[7px] border-b border-gray-300 text-[13px]">
                  <span className="w-6 text-right text-gray-500 tabular-nums">{n}.</span>
                  <span className="w-40 font-medium break-words">{w.word}</span>
                  <span className={`flex-1 ${answer ? "text-blue-800" : ""}`}>{answer ? w.meaning : ""}</span>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
    </section>
  );

  return (
    <div className="vocab-print min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <style>{`
        .vocab-sheet { width: 210mm; min-height: 297mm; padding: 14mm 14mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); margin-bottom: 12px; }
        @media print {
          @page { size: A4; margin: 0; }
          .vocab-sheet { box-shadow: none; margin: 0; }
          .no-print { display: none !important; }
        }
        .break-before-page { break-before: page; }
      `}</style>
      <div className="no-print max-w-[210mm] mx-auto mb-3 flex items-center gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">인쇄하기</button>
        <span className="text-xs text-gray-500">인쇄 창에서 &quot;머리글/바닥글&quot;은 끄고 A4로 인쇄하세요.</span>
      </div>
      {sheet(false)}
      {sp.key === "1" && sheet(true)}
    </div>
  );
}
