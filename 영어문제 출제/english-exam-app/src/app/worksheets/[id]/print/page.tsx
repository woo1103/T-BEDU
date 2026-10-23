"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MathText from "@/components/MathText";
import { stripFigurePlaceholder } from "@/lib/math-worksheet";

interface PrintItem {
  number: number;
  answer: string;
  problemLatex: string | null;
  figureImageId: string | null;
  solution: string | null;
}
interface PrintData {
  worksheet: { id: string; title: string; grade: string | null; source: string | null };
  items: PrintItem[];
}

type Split = 2 | 4;
const LAYOUT_KEY = "worksheet-print-layout";

// A4 세로(210×297mm), 여백 12mm. 쪽 머리 14mm를 뺀 나머지를 칸으로 나눈다.
const PAGE_H_MM = 297 - 24;
const HEADER_MM = 14;
const GRID_H_MM = PAGE_H_MM - HEADER_MM;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default function WorksheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState("");
  const [split, setSplit] = useState<Split>(4);
  const [withAnswers, setWithAnswers] = useState(true);
  const [overflow, setOverflow] = useState<number[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/worksheets/${id}/print`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "학습지를 불러오지 못했어요.");
        // 지난번에 고른 분할을 기억(브라우저 저장소 — 못 읽으면 기본 4분할)
        try {
          const v = Number(localStorage.getItem(LAYOUT_KEY));
          if (v === 2 || v === 4) setSplit(v);
        } catch {
          /* 기본값 사용 */
        }
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "오류"));
  }, [id]);

  function changeSplit(v: Split) {
    setSplit(v);
    try {
      localStorage.setItem(LAYOUT_KEY, String(v));
    } catch {
      /* 저장 못 해도 동작 */
    }
  }

  // 칸을 넘치는 문제 찾기(화면에서만 표시)
  const measure = useCallback(() => {
    const cells = sheetRef.current?.querySelectorAll<HTMLElement>("[data-cell]") ?? [];
    const over: number[] = [];
    cells.forEach((c) => {
      const body = c.querySelector<HTMLElement>("[data-body]");
      if (body && body.scrollHeight > c.clientHeight - 2) over.push(Number(c.dataset.cell));
    });
    setOverflow(over);
  }, []);
  // 그려진 뒤 다음 프레임에 잰다(레이아웃 확정 후)
  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [data, split, measure]);

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-600">{error}</p>
        <Link href="/worksheets" className="text-sm text-blue-600 hover:underline">
          학습지 목록으로
        </Link>
      </div>
    );
  }
  if (!data) return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;

  const printable = data.items.filter((it) => it.problemLatex);
  if (printable.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-600">이 학습지는 PDF로 올린 문제지라 여기서 다시 인쇄할 수 없어요. 문제은행에서 만든 학습지만 인쇄돼요.</p>
        <Link href="/worksheets" className="text-sm text-blue-600 hover:underline">
          학습지 목록으로
        </Link>
      </div>
    );
  }

  const pages = chunk(printable, split);
  const cellH = split === 4 ? GRID_H_MM / 2 : GRID_H_MM;
  const totalPages = pages.length + (withAnswers ? 1 : 0);

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .ws-page { box-shadow: none !important; margin: 0 !important; break-after: page; }
          .ws-page:last-child { break-after: auto; }
          .ws-cell[data-over="true"] { outline: none !important; }
        }
      `}</style>

      {/* 조작 바 (인쇄 시 숨김) */}
      <div className="print:hidden flex flex-wrap items-center gap-3 mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <Link href="/math-bank" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; 문제은행
        </Link>
        <span className="font-semibold text-gray-800">{data.worksheet.title}</span>
        <div className="flex items-center gap-1 ml-auto" role="group" aria-label="한 쪽에 몇 문제">
          {([2, 4] as Split[]).map((v) => (
            <button
              key={v}
              onClick={() => changeSplit(v)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                split === v ? "bg-emerald-700 text-white border-emerald-700" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {v}분할
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} />
          정답지 포함
        </label>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-900"
        >
          인쇄 / PDF로 저장
        </button>
      </div>

      {overflow.length > 0 && (
        <p className="print:hidden mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {overflow.map((n) => `${n}번`).join(", ")} 문제가 칸보다 길어 잘릴 수 있어요(빨간 테두리).
          {split === 4 ? " 2분할로 바꾸면 칸이 두 배가 돼요." : " 문제 내용을 줄이거나 따로 인쇄해 주세요."}
        </p>
      )}

      {/* 학습지 쪽들 */}
      <div ref={sheetRef} className="flex flex-col items-center gap-6 print:gap-0">
        {pages.map((items, pi) => (
          <section
            key={pi}
            className="ws-page bg-white shadow-md"
            style={{ width: "186mm", height: `${PAGE_H_MM}mm`, padding: 0, boxSizing: "content-box" }}
          >
            <header
              className="flex items-end justify-between border-b-2 border-gray-900"
              style={{ height: `${HEADER_MM - 3}mm`, marginBottom: "3mm" }}
            >
              <div className="text-base font-bold">
                {data.worksheet.title}
                {data.worksheet.grade && <span className="ml-2 text-sm font-normal text-gray-600">{data.worksheet.grade}</span>}
              </div>
              <div className="text-xs text-gray-700 flex gap-4">
                <span>이름 ____________</span>
                <span>
                  {pi + 1} / {totalPages}
                </span>
              </div>
            </header>
            <div
              className="grid"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: split === 4 ? "1fr 1fr" : "1fr",
                height: `${GRID_H_MM}mm`,
              }}
            >
              {items.map((it, ci) => {
                const over = overflow.includes(it.number);
                return (
                  <div
                    key={it.number}
                    data-cell={it.number}
                    data-over={over}
                    className={`ws-cell overflow-hidden ${ci % 2 === 0 ? "border-r border-gray-400 pr-[4mm]" : "pl-[4mm]"} ${
                      split === 4 && ci < 2 ? "border-b border-gray-300" : ""
                    } ${over ? "outline outline-2 outline-red-500 -outline-offset-2" : ""}`}
                    style={{ height: `${cellH}mm`, paddingTop: "2mm" }}
                  >
                    <div data-body className="text-[10.5pt] leading-relaxed">
                      <div className="flex gap-1.5">
                        <span className="font-bold">{it.number}.</span>
                        <div className="flex-1 min-w-0">
                          <MathText text={it.figureImageId ? stripFigurePlaceholder(it.problemLatex!) : it.problemLatex!} />
                        </div>
                      </div>
                      {it.figureImageId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/math-images/${it.figureImageId}`}
                          alt={`${it.number}번 그림`}
                          onLoad={measure}
                          className="mt-2 mx-auto block"
                          style={{ maxWidth: "100%", maxHeight: `${cellH * 0.45}mm` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {withAnswers && (
          <section className="ws-page bg-white shadow-md" style={{ width: "186mm", minHeight: `${PAGE_H_MM}mm` }}>
            <header className="border-b-2 border-gray-900 pb-2 mb-4 text-base font-bold">
              {data.worksheet.title} · 정답
            </header>
            <div className="grid grid-cols-5 gap-2 text-sm">
              {printable.map((it) => (
                <div key={it.number} className="border border-gray-300 rounded px-2 py-1 flex gap-2">
                  <span className="font-bold">{it.number}</span>
                  <MathText text={it.answer} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
