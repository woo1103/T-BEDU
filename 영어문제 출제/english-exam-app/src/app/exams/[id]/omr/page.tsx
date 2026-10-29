"use client";

import { use, useEffect, useState } from "react";

interface ExamData {
  title: string;
  headerInfo: string | null;
  items: { orderNum: number; question: { questionType: string; choices: string } }[];
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const PER_COLUMN = 10;

function choiceCount(choices: string): number {
  try {
    const parsed = JSON.parse(choices);
    if (Array.isArray(parsed) && parsed.length >= 2) return Math.min(parsed.length, 9);
  } catch {
    /* 기본 5지선다 */
  }
  return 5;
}

// 시험지용 OMR 답안지(A4 한 장) — 인쇄해 나눠 주고, 걷은 답은 '종이 답 입력'에서 숫자로 넣는다
export default function OmrSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "시험지를 불러오지 못했어요.");
        setExam(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "시험지를 불러오지 못했어요."));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!exam) return <p className="text-sm text-gray-400">불러오는 중...</p>;

  const objective = exam.items.filter((it) => !it.question.questionType.startsWith("naesin_writing"));
  const writing = exam.items.filter((it) => it.question.questionType.startsWith("naesin_writing"));
  const columns: (typeof objective)[] = [];
  for (let i = 0; i < objective.length; i += PER_COLUMN) columns.push(objective.slice(i, i + PER_COLUMN));

  let school = "";
  try {
    school = (JSON.parse(exam.headerInfo ?? "{}") as { school?: string }).school ?? "";
  } catch {
    /* 없음 */
  }

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { .omr-page { box-shadow: none !important; margin: 0 !important; } }
      `}</style>

      <div className="print:hidden flex items-center gap-3 mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-600 flex-1">
          학생 수만큼 인쇄해 나눠 주세요(인쇄 창에서 매수 지정). 걷은 답은 <b>과제 → 종이 답 입력</b>에서 숫자로 넣으면 바로 채점돼요.
        </p>
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800"
        >
          인쇄
        </button>
      </div>

      <div
        className="omr-page bg-white mx-auto shadow-md text-black"
        style={{ width: "186mm", minHeight: "273mm", padding: "6mm", fontFamily: "'Noto Serif KR', serif" }}
      >
        <div className="text-center border-b-2 border-black pb-2">
          {school && <p className="text-xs">{school}</p>}
          <h1 className="text-lg font-bold">{exam.title}</h1>
          <p className="text-xs mt-0.5">답안지</p>
        </div>

        <table className="w-full mt-3 border-collapse text-sm" style={{ border: "1.5px solid black" }}>
          <tbody>
            <tr>
              {["반", "번호", "이름"].map((h, i) => (
                <td key={h} className="border border-black" style={{ width: i === 2 ? "40%" : "30%" }}>
                  <span className="inline-block px-2 py-2 border-r border-black bg-gray-100 font-medium">{h}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <p className="text-xs mt-2">
          답은 해당 번호의 동그라미를 <b>●</b> 처럼 진하게 칠하세요. 고칠 때는 깨끗이 지우세요.
        </p>

        {objective.length > 0 && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {columns.map((col, ci) => (
              <table key={ci} className="border-collapse text-sm" style={{ border: "1.5px solid black" }}>
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-1.5 py-1 font-medium">번호</th>
                    <th className="border border-black px-1.5 py-1 font-medium">답</th>
                  </tr>
                </thead>
                <tbody>
                  {col.map((it) => (
                    <tr key={it.orderNum} style={{ height: "8.2mm" }}>
                      <td className="border border-black text-center font-bold px-1.5">{it.orderNum}</td>
                      <td className="border border-black px-1.5 whitespace-nowrap" style={{ letterSpacing: "0.12em" }}>
                        {CIRCLED.slice(0, choiceCount(it.question.choices)).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        )}

        {writing.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-bold">서술형</p>
            {writing.map((it) => (
              <div key={it.orderNum} className="border border-black" style={{ minHeight: "26mm" }}>
                <div className="flex justify-between text-xs px-2 py-1 border-b border-black bg-gray-100">
                  <span className="font-bold">{it.orderNum}번</span>
                  <span>점수: ______</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
