"use client";

import { useState } from "react";
import { monthOf, reportsToCsv, shiftMonth, type MonthlyReport } from "@/lib/report-format";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 학부모 월간 리포트 내려받기: 학생 한 명(studentId) 또는 반 전체(classId)
export default function ReportDownload({
  studentId,
  classId,
  fileLabel,
  compact = false,
}: {
  studentId?: string;
  classId?: string;
  fileLabel: string; // 파일 이름 앞부분(학생 이름·반 이름)
  compact?: boolean;
}) {
  const thisMonth = monthOf(new Date());
  // 이번 달과 지난 11달
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth, -i));
  const [month, setMonth] = useState(thisMonth);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [msg, setMsg] = useState("");

  async function fetchReports(): Promise<MonthlyReport[]> {
    const q = new URLSearchParams({ month, ...(studentId ? { studentId } : {}), ...(classId ? { classId } : {}) });
    const res = await fetch(`/api/teacher/reports?${q}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "리포트를 불러오지 못했어요.");
    if (!d.reports.length) throw new Error("이 반에 학생이 없어요.");
    return d.reports;
  }

  async function run(kind: "pdf" | "csv") {
    setBusy(kind);
    setMsg("");
    try {
      const reports = await fetchReports();
      const name = `${fileLabel}_${month}_월간리포트`;
      if (kind === "csv") {
        save(new Blob([reportsToCsv(reports)], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
      } else {
        // PDF 라이브러리는 필요할 때만 불러온다
        const [{ pdf }, { default: ParentReportPDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/pdf/ParentReportPDF"),
        ]);
        save(await pdf(<ParentReportPDF reports={reports} />).toBlob(), `${name}.pdf`);
      }
      setMsg(reports.length > 1 ? `${reports.length}명 리포트를 받았어요.` : "");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "리포트를 만들지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  const btn = compact
    ? "px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    : "px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className={compact ? "border border-gray-300 rounded-lg px-2 py-1 text-xs" : "border border-gray-300 rounded-lg px-2 py-2 text-sm"}
        aria-label="리포트 월"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m.slice(0, 4)}년 {Number(m.slice(5))}월
          </option>
        ))}
      </select>
      <button onClick={() => run("pdf")} disabled={!!busy} className={btn}>
        {busy === "pdf" ? "만드는 중..." : "📄 리포트 PDF"}
      </button>
      <button onClick={() => run("csv")} disabled={!!busy} className={btn}>
        {busy === "csv" ? "만드는 중..." : "CSV"}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
