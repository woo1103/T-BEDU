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
  // A4 한 면에 50문항: 왼쪽 단 1~25, 오른쪽 단 26~50. 50개가 넘으면 다음 면으로(번호는 이어서)
  const PER_PAGE = 50;
  const PER_COL = 25;
  const pages: Word[][] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));
  if (pages.length === 0) pages.push([]);

  const sheet = (answer: boolean, list: Word[], pageIndex: number) => (
    <section
      key={`${answer ? "a" : "q"}${pageIndex}`}
      className={`vocab-sheet bg-white mx-auto ${answer || pageIndex > 0 ? "break-before-page" : ""}`}
    >
      <div className="border-b-2 border-black pb-1.5 mb-2">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{title} {answer ? "· 정답" : "· 단어 시험"}</h1>
            <p className="text-[11px] text-gray-600">
              {range} · {items.length}문항 · 영어 단어의 뜻을 쓰시오.
              {pages.length > 1 && ` (${pageIndex + 1}/${pages.length}쪽)`}
            </p>
          </div>
          {!answer && pageIndex === 0 && (
            <div className="text-[13px] flex gap-4 whitespace-nowrap">
              <span>반 ______</span>
              <span>이름 __________</span>
              <span>점수 ____ / {items.length}</span>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6">
        {[0, 1].map((ci) => (
          <ol key={ci}>
            {list.slice(ci * PER_COL, ci * PER_COL + PER_COL).map((w, i) => {
              const n = pageIndex * PER_PAGE + ci * PER_COL + i + 1;
              return (
                <li key={w.id} className="vocab-row flex items-end gap-2 border-b border-gray-300 text-[12.5px]">
                  <span className="w-7 shrink-0 text-right text-gray-500 tabular-nums">{n}.</span>
                  <span className="w-[34mm] shrink-0 font-medium truncate" title={w.word}>{w.word}</span>
                  <span className={`flex-1 min-w-0 truncate ${answer ? "text-blue-800" : ""}`}>{answer ? w.meaning : ""}</span>
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
        .vocab-sheet { box-sizing: border-box; width: 210mm; height: 296.5mm; overflow: hidden; padding: 11mm 12mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); margin-bottom: 12px; }
        /* 25줄 × 10mm = 250mm: 머리글(약 18mm)과 함께 A4 한 면 안에 들어간다(쪽 높이 296.5mm는 인쇄 때 빈 쪽이 끼지 않게 살짝 줄임) */
        .vocab-row { height: 10mm; padding-bottom: 1.3mm; }
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
      {pages.map((p, i) => sheet(false, p, i))}
      {sp.key === "1" && pages.map((p, i) => sheet(true, p, i))}
    </div>
  );
}
