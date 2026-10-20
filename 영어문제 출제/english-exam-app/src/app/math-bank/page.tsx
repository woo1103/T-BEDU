"use client";

import { useEffect, useState } from "react";
import MathText from "@/components/MathText";

interface MathProblem {
  id: string;
  source: string | null;
  sourceType: string | null;
  grade: string | null;
  unit: string | null;
  difficulty: string | null;
  number: number | null;
  problemLatex: string;
  answer: string | null;
  solution: string | null;
}

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];

export default function MathBankPage() {
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [facets, setFacets] = useState<{ grades: string[]; units: string[]; sources: string[] }>({
    grades: [],
    units: [],
    sources: [],
  });
  const [loading, setLoading] = useState(true);

  // 업로드
  const [source, setSource] = useState("");
  const [sourceType, setSourceType] = useState("기출");
  const [uploadGrade, setUploadGrade] = useState("고1");
  const [ingesting, setIngesting] = useState(false);
  const [ingestLog, setIngestLog] = useState("");

  // 필터
  const [fGrade, setFGrade] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fSource, setFSource] = useState("");
  const [fDiff, setFDiff] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (fGrade) sp.set("grade", fGrade);
    if (fUnit) sp.set("unit", fUnit);
    if (fSource) sp.set("source", fSource);
    if (fDiff) sp.set("difficulty", fDiff);
    if (q.trim()) sp.set("q", q.trim());
    const d = await (await fetch(`/api/math-problems?${sp}`)).json();
    setProblems(d.problems || []);
    setFacets(d.facets || { grades: [], units: [], sources: [] });
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fGrade, fUnit, fSource, fDiff]);

  async function onFile(file: File) {
    setIngesting(true);
    setIngestLog("문제 인식 중... (수식을 LaTeX로 변환)");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1] || "");
        r.onerror = () => reject(new Error("파일 읽기 실패"));
        r.readAsDataURL(file);
      });

      // R2가 설정돼 있으면 원본 이미지도 보존(그래프·도형). 미설정이면 생략.
      let imageKey: string | undefined;
      try {
        const u = await (
          await fetch("/api/math-problems/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type }),
          })
        ).json();
        if (u.enabled && u.uploadUrl) {
          const put = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (put.ok) imageKey = u.key;
        }
      } catch {
        /* R2 미설정/실패 시 이미지 생략 */
      }

      const res = await fetch("/api/math-problems/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          mediaType: file.type,
          source: source || undefined,
          sourceType,
          grade: uploadGrade || undefined,
          imageKey,
        }),
      });
      if (!res.ok) {
        setIngestLog("");
        alert((await res.json()).error || "수집 실패");
        return;
      }
      const r = await res.json();
      setIngestLog(`${r.count}문항 수집 완료.`);
      await load();
    } catch (e) {
      setIngestLog("");
      alert(e instanceof Error ? e.message : "오류");
    } finally {
      setIngesting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 문제를 은행에서 삭제할까요?")) return;
    const res = await fetch(`/api/math-problems/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">수학 문제 은행</h2>
        <p className="text-sm text-gray-500 mt-1">
          기출·교재 문제 이미지/PDF를 올리면 AI가 문항을 분리하고 수식을 LaTeX로 인식해 저장합니다.
          출처·학년·단원으로 검색하고, 나중에 원본 그대로 또는 쌍둥이 문제로 출제합니다.
        </p>
      </div>

      {/* 업로드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800">문제 업로드 (자동 수집)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="출처 (예: 2024 9월 모평)"
            className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="기출">기출</option>
            <option value="교재">교재</option>
            <option value="자작">자작</option>
          </select>
          <select
            value={uploadGrade}
            onChange={(e) => setUploadGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <label
          className={`inline-block px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
            ingesting ? "bg-purple-200 text-purple-500" : "bg-purple-600 text-white hover:bg-purple-700"
          }`}
        >
          {ingesting ? "수집 중..." : "📷 문제 이미지/PDF 업로드"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            className="hidden"
            disabled={ingesting}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {ingestLog && <p className="text-xs text-gray-500">{ingestLog}</p>}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-2 items-center">
        <select value={fGrade} onChange={(e) => setFGrade(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
          <option value="">학년 전체</option>
          {facets.grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={fUnit} onChange={(e) => setFUnit(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
          <option value="">단원 전체</option>
          {facets.units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={fSource} onChange={(e) => setFSource(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
          <option value="">출처 전체</option>
          {facets.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fDiff} onChange={(e) => setFDiff(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
          <option value="">난이도 전체</option>
          {["하", "중", "상", "킬러"].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="문제 검색 후 Enter"
          className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
        />
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 font-semibold text-gray-800">
          문제 {loading ? "" : `(${problems.length})`}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : problems.length === 0 ? (
          <div className="p-8 text-center text-gray-400">문제가 없습니다. 위에서 업로드하세요.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {problems.map((p) => (
              <li key={p.id} className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  {p.source && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{p.source}</span>}
                  {p.grade && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{p.grade}</span>}
                  {p.unit && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{p.unit}</span>}
                  {p.difficulty && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{p.difficulty}</span>}
                  {p.number != null && <span className="text-gray-400">#{p.number}</span>}
                  <button
                    onClick={() => remove(p.id)}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed">
                  <MathText text={p.problemLatex} />
                </div>
                {p.answer && (
                  <p className="text-xs text-gray-500">
                    정답: <MathText text={p.answer} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
