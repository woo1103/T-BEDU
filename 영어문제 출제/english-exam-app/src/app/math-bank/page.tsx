"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MathText from "@/components/MathText";
import FigureCropper from "@/components/math/FigureCropper";
import MathProblemEditor from "@/components/math/MathProblemEditor";
import MathTypePicker, { typeLabel, useMathTypes } from "@/components/math/MathTypePicker";
import { cropToJpeg, openPages, pageToJpeg, type EncodedImage } from "@/lib/page-images";
import { answerFromStoredValue, detectChoicesCount, normalizeAnswer } from "@/lib/math-worksheet";

interface MathProblem {
  id: string;
  source: string | null;
  sourceType: string | null;
  grade: string | null;
  unit: string | null;
  difficulty: string | null;
  number: number | null;
  sourcePage: number | null;
  problemLatex: string;
  answer: string | null;
  solution: string | null;
  cropImageId: string | null;
  figureImageId: string | null;
  typeCode: string | null;
}

type Box = [number, number, number, number];

// 업로드 인식 결과(아직 저장 전)
interface ExtractedProblem {
  number?: number;
  problemLatex: string;
  solution?: string;
  unit?: string;
  difficulty?: string;
  box?: Box | null;
  figureBox?: Box | null;
}

// 확인 목록의 한 문항: 고른 것만 은행에 저장한다
interface Draft {
  key: string;
  source: string;
  sourceType: string;
  grade: string;
  page: number;
  number: number | null;
  problemLatex: string;
  solution: string | null;
  unit: string | null;
  difficulty: string | null;
  crop: EncodedImage | null;
  figure: EncodedImage | null;
  checked: boolean;
}

const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];
const SELECTION_KEY = "mathbank-selection";

function loadSelection(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SELECTION_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function MathBankPage() {
  const router = useRouter();
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
  const stopRef = useRef(false);
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [draftOriginal, setDraftOriginal] = useState<Record<string, boolean>>({});

  // 저장 안 한 인식 결과가 있으면 창을 닫거나 새로 고칠 때 한 번 묻는다(AI로 다시 읽어야 하므로)
  useEffect(() => {
    if (drafts.length === 0 && !ingesting) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts.length, ingesting]);

  // 필터
  const [fGrade, setFGrade] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fSource, setFSource] = useState("");
  const [fDiff, setFDiff] = useState("");
  // 유형코드표에서 "문제 보기"로 오면 ?type= 으로 그 유형을 거른다
  const [fType, setFType] = useState("");
  const types = useMathTypes();
  const [q, setQ] = useState("");

  // 선택(학습지 만들기) — 필터를 바꿔도·새로고침해도 유지, 선택한 순서 = 학습지 순서
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<Record<string, MathProblem>>({});
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [makingSheet, setMakingSheet] = useState(false);
  const [cropping, setCropping] = useState<MathProblem | null>(null);
  const [editing, setEditing] = useState<MathProblem | null>(null);

  useEffect(() => {
    setSelected(loadSelection());
    const t = new URLSearchParams(window.location.search).get("type");
    if (t) setFType(t);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selected));
    } catch {
      /* 저장 불가 환경이면 이번 화면에서만 유지 */
    }
  }, [selected]);

  async function load() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (fGrade) sp.set("grade", fGrade);
    if (fUnit) sp.set("unit", fUnit);
    if (fSource) sp.set("source", fSource);
    if (fDiff) sp.set("difficulty", fDiff);
    if (fType) sp.set("type", fType);
    if (q.trim()) sp.set("q", q.trim());
    const d = await (await fetch(`/api/math-problems?${sp}`)).json();
    const list: MathProblem[] = d.problems || [];
    setProblems(list);
    setSelectedInfo((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
    setFacets(d.facets || { grades: [], units: [], sources: [] });
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fGrade, fUnit, fSource, fDiff, fType]);

  // 쪽마다: 쪽 이미지 인식 → 문항 영역·그림을 잘라 "확인 목록"에 담는다(아직 저장 안 함).
  // 선생님이 확인 목록에서 고른 문항만 은행에 저장한다. 인식이 실패한 쪽은 건너뛰고 끝에 알려 준다.
  async function onFile(file: File) {
    setIngesting(true);
    stopRef.current = false;
    let found = 0;
    const failed: number[] = [];
    const meta = { source: source.trim(), sourceType, grade: uploadGrade };
    try {
      setIngestLog("파일 여는 중...");
      const doc = await openPages(file);
      const from = Math.max(1, Math.min(doc.count, Number(pageFrom) || 1));
      const to = Math.max(from, Math.min(doc.count, Number(pageTo) || doc.count));
      for (let page = from; page <= to; page++) {
        if (stopRef.current) break;
        setIngestLog(`쪽 ${page}/${doc.count} 인식 중 · 지금까지 문제 ${found}개 찾음` + (failed.length ? ` · 실패한 쪽 ${failed.join(", ")}` : ""));
        try {
          const canvas = await doc.render(page);
          const img = pageToJpeg(canvas);
          const res = await fetch("/api/math-problems/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              base64: img.base64,
              mediaType: img.mime,
              source: meta.source || undefined,
              grade: meta.grade || undefined,
              page,
            }),
          });
          const r = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(r.error || "인식 실패");
          const list = (r.problems ?? []) as ExtractedProblem[];
          const drafts: Draft[] = list.map((p, i) => ({
            key: `${Date.now()}-${page}-${i}`,
            ...meta,
            page,
            number: p.number ?? null,
            problemLatex: p.problemLatex,
            solution: p.solution ?? null,
            unit: p.unit ?? null,
            difficulty: p.difficulty ?? null,
            crop: p.box ? cropToJpeg(canvas, p.box) : null,
            // 그림 좌표는 몇 % 빗나갈 수 있음: 여유가 작으면 그림이 잘리고 크면 주변 글자가 들어온다 → 2%로 절충,
            // 어긋나면 저장 후 목록의 "그림 다시 자르기"로 바로잡는다
            figure: p.figureBox ? cropToJpeg(canvas, p.figureBox, 0.02) : null,
            checked: true,
          }));
          found += drafts.length;
          setDrafts((d) => [...d, ...drafts]);
        } catch (e) {
          console.warn(`쪽 ${page} 인식 실패`, e);
          failed.push(page);
        }
      }
      setIngestLog(
        (stopRef.current ? "멈춤 · " : "인식 끝 · ") +
          `문제 ${found}개를 찾았어요. 아래 확인 목록에서 저장할 문제만 골라 "저장"을 누르세요.` +
          (failed.length
            ? ` 실패한 쪽: ${failed.join(", ")} — 시작·끝 쪽을 그 쪽으로 맞추고 같은 파일을 다시 올리면 그 쪽만 읽어요.`
            : "")
      );
    } catch (e) {
      setIngestLog(`${e instanceof Error ? e.message : "오류"} · 찾은 문제 ${found}개는 확인 목록에 있어요`);
    } finally {
      setIngesting(false);
    }
  }

  // 확인 목록에서 고른 문항만 한 문항씩 저장(문제 + 원본·그림). 저장된 것은 확인 목록에서 빠진다
  async function saveDrafts() {
    const targets = drafts.filter((d) => d.checked);
    if (targets.length === 0) return;
    setSavingDrafts(true);
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const d of targets) {
        setIngestLog(`저장 중 ${ok + errors.length + 1}/${targets.length}`);
        const res = await fetch("/api/math-problems/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: d.source || undefined,
            sourceType: d.sourceType,
            grade: d.grade || undefined,
            page: d.page,
            problem: {
              number: d.number ?? undefined,
              problemLatex: d.problemLatex,
              solution: d.solution ?? undefined,
              unit: d.unit ?? undefined,
              difficulty: d.difficulty ?? undefined,
            },
            crop: d.crop ?? undefined,
            figure: d.figure ?? undefined,
          }),
        });
        if (res.ok) {
          ok++;
          setDrafts((list) => list.filter((x) => x.key !== d.key));
        } else {
          const r = await res.json().catch(() => ({}));
          errors.push(`${d.page}쪽 #${d.number ?? "?"}: ${r.error || "저장 실패"}`);
        }
      }
      setIngestLog(
        `문제 ${ok}개를 은행에 저장했어요.` + (errors.length ? ` 저장 못 한 문제 ${errors.length}개(확인 목록에 남김): ${errors.slice(0, 3).join(" / ")}` : "")
      );
      await load();
    } finally {
      setSavingDrafts(false);
    }
  }

  function discardDrafts(onlyUnchecked: boolean) {
    const n = onlyUnchecked ? drafts.filter((d) => !d.checked).length : drafts.length;
    if (n === 0) return;
    if (!confirm(`확인 목록에서 문제 ${n}개를 버릴까요? (은행에는 저장되지 않아요)`)) return;
    setDrafts((list) => (onlyUnchecked ? list.filter((d) => d.checked) : []));
  }

  async function remove(id: string) {
    if (!confirm("이 문제를 은행에서 삭제할까요?")) return;
    const res = await fetch(`/api/math-problems/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSelected((s) => s.filter((x) => x !== id));
      await load();
    } else {
      alert((await res.json().catch(() => ({}))).error || "삭제 실패");
    }
  }

  // 고른 문제 한꺼번에 삭제(잘못 올린 문제지 정리 등). 학습지에 쓰인 문제는 서버가 남긴다
  const [bulkDeleting, setBulkDeleting] = useState(false);
  async function removeSelected() {
    if (selected.length === 0) return;
    if (!confirm(`고른 문제 ${selected.length}개를 은행에서 삭제할까요?
잘라 둔 그림도 함께 지워지고 되돌릴 수 없어요.
(학습지에 쓰인 문제는 남겨 둬요)`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/math-problems/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return alert(d.error || "삭제 실패");
      const kept: { id: string; worksheets: string[] }[] = d.kept ?? [];
      const titles = [...new Set(kept.flatMap((k) => k.worksheets))];
      alert(
        `문제 ${d.removed}개를 삭제했어요.` +
          (kept.length ? `
학습지에 쓰인 ${kept.length}개는 남겨 두고 선택에 그대로 둘게요: ${titles.slice(0, 5).join(", ")}${titles.length > 5 ? " 외" : ""}` : "")
      );
      // 남긴 문제만 선택에 남긴다(어느 것인지 바로 보이게)
      setSelected(kept.map((k) => k.id));
      await load();
    } finally {
      setBulkDeleting(false);
    }
  }

  async function removeFigure(id: string) {
    if (!confirm("이 문제의 그림을 뺄까요? (잘못 잘렸을 때)")) return;
    const res = await fetch(`/api/math-problems/${id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figure: null }),
    });
    if (res.ok) await load();
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const visibleIds = problems.map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">수학 문제 은행</h2>
        <p className="text-sm text-gray-500 mt-1">
          기출·교재 PDF나 사진을 올리면 쪽마다 AI가 문항을 나누고 수식을 인식합니다. 확인 목록에서 고른 문제만 저장돼요. 그래프·도형은 그림으로 잘라 함께
          저장해요. 문제를 골라 학습지를 만들고 2분할·4분할로 인쇄할 수 있습니다.
        </p>
      </div>

      {/* 업로드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800">문제 업로드</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            id="mb-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="출처 (예: 2024 9월 모평)"
            className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            id="mb-source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="기출">기출</option>
            <option value="교재">교재</option>
            <option value="자작">자작</option>
          </select>
          <select
            id="mb-grade"
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
        <div className="flex items-center gap-3 flex-wrap">
          <label
            className={`inline-block px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
              ingesting ? "bg-purple-200 text-purple-500" : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            {ingesting ? "수집 중..." : "📷 문제 PDF/사진 업로드"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              disabled={ingesting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <input
              id="mb-page-from"
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value.replace(/\D/g, ""))}
              placeholder="처음"
              inputMode="numeric"
              disabled={ingesting}
              className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              aria-label="시작 쪽"
            />
            쪽부터
            <input
              id="mb-page-to"
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value.replace(/\D/g, ""))}
              placeholder="끝"
              inputMode="numeric"
              disabled={ingesting}
              className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              aria-label="끝 쪽"
            />
            쪽까지 (비우면 전체)
          </span>
          {ingesting && (
            <button
              onClick={() => (stopRef.current = true)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              이번 쪽까지만 하고 멈추기
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          올리면 바로 저장되지 않고 아래 &quot;확인 목록&quot;에 모여요. 저장할 문제만 골라 저장을 누르세요.
        </p>
        {ingestLog && <p className="text-xs text-gray-600">{ingestLog}</p>}
      </div>

      {/* 확인 목록: 인식했지만 아직 저장 안 한 문제 */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-purple-200">
          <div className="p-4 border-b border-purple-100 flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-800">
              확인 목록 · {drafts.length}문제 중 {drafts.filter((d) => d.checked).length}개 고름
            </span>
            <button
              onClick={() => {
                const all = drafts.every((d) => d.checked);
                setDrafts((list) => list.map((d) => ({ ...d, checked: !all })));
              }}
              className="text-xs text-purple-700 hover:text-purple-900"
            >
              {drafts.every((d) => d.checked) ? "모두 해제" : "모두 고르기"}
            </button>
            <span className="ml-auto flex items-center gap-2">
              <button
                onClick={() => discardDrafts(false)}
                disabled={savingDrafts || ingesting}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                모두 버리기
              </button>
              {drafts.some((d) => !d.checked) && (
                <button
                  onClick={() => discardDrafts(true)}
                  disabled={savingDrafts || ingesting}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  안 고른 {drafts.filter((d) => !d.checked).length}개 버리기
                </button>
              )}
              <button
                onClick={saveDrafts}
                disabled={savingDrafts || ingesting || !drafts.some((d) => d.checked)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {savingDrafts ? "저장 중..." : ingesting ? "인식이 끝나면 저장" : `고른 ${drafts.filter((d) => d.checked).length}개 저장`}
              </button>
            </span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
            {drafts.map((d) => (
              <li key={d.key} className={`p-4 space-y-2 ${d.checked ? "bg-purple-50/40" : "opacity-60"}`}>
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <input
                    type="checkbox"
                    checked={d.checked}
                    onChange={() => setDrafts((list) => list.map((x) => (x.key === d.key ? { ...x, checked: !x.checked } : x)))}
                    className="mr-1"
                    aria-label="저장할 문제로 고르기"
                  />
                  <span className="text-gray-500">
                    {d.page}쪽 #{d.number ?? "?"}
                  </span>
                  {d.unit && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{d.unit}</span>}
                  {d.difficulty && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{d.difficulty}</span>}
                  {d.crop && (
                    <button
                      onClick={() => setDraftOriginal((s) => ({ ...s, [d.key]: !s[d.key] }))}
                      className="ml-auto text-gray-500 hover:text-gray-800"
                    >
                      {draftOriginal[d.key] ? "원본 닫기" : "원본 보기"}
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-800 leading-relaxed">
                  <MathText text={d.problemLatex} />
                </div>
                {d.figure && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${d.figure.mime};base64,${d.figure.base64}`}
                    alt="문제 그림"
                    className="max-h-56 border border-gray-100 rounded"
                  />
                )}
                {draftOriginal[d.key] && d.crop && (
                  <div className="border border-dashed border-gray-300 rounded p-2">
                    <p className="text-xs text-gray-400 mb-1">원본(인식이 맞는지 비교용)</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:${d.crop.mime};base64,${d.crop.base64}`} alt="원본 문제" className="max-h-96" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <MathTypePicker value={fType} onChange={setFType} mode="filter" compact />
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
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <span className="font-semibold text-gray-800">문제 {loading ? "" : `(${problems.length})`}</span>
          {problems.length > 0 && (
            <button
              onClick={() =>
                setSelected((s) =>
                  allVisibleSelected ? s.filter((id) => !visibleIds.includes(id)) : [...s, ...visibleIds.filter((id) => !s.includes(id))]
                )
              }
              className="text-xs text-emerald-700 hover:text-emerald-900"
            >
              {allVisibleSelected ? "보이는 문제 선택 해제" : "보이는 문제 모두 선택"}
            </button>
          )}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : problems.length === 0 ? (
          <div className="p-8 text-center text-gray-400">문제가 없습니다. 위에서 업로드하세요.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {problems.map((p) => {
              const isSel = selected.includes(p.id);
              return (
                <li key={p.id} className={`p-4 space-y-2 ${isSel ? "bg-emerald-50/50" : ""}`}>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <input
                      type="checkbox"
                      id={`sel-${p.id}`}
                      checked={isSel}
                      onChange={() => toggle(p.id)}
                      className="mr-1"
                      aria-label="학습지에 담기"
                    />
                    {isSel && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                        {selected.indexOf(p.id) + 1}번
                      </span>
                    )}
                    {p.source && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{p.source}</span>}
                    {p.grade && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{p.grade}</span>}
                    {p.unit && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{p.unit}</span>}
                    {p.difficulty && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{p.difficulty}</span>}
                    {p.typeCode && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700" title={typeLabel(types, p.typeCode)}>
                        <span className="font-mono">{p.typeCode}</span> {typeLabel(types, p.typeCode).split(" · ").pop()}
                      </span>
                    )}
                    {p.number != null && (
                      <span className="text-gray-400">
                        {p.sourcePage ? `${p.sourcePage}쪽 ` : ""}#{p.number}
                      </span>
                    )}
                    <span className="ml-auto flex gap-3">
                      <button onClick={() => setEditing(p)} className="text-emerald-700 hover:text-emerald-900">
                        고치기
                      </button>
                      {p.cropImageId && (
                        <button
                          onClick={() => setShowOriginal((s) => ({ ...s, [p.id]: !s[p.id] }))}
                          className="text-gray-500 hover:text-gray-800"
                        >
                          {showOriginal[p.id] ? "원본 닫기" : "원본 보기"}
                        </button>
                      )}
                      {p.cropImageId && (
                        <button onClick={() => setCropping(p)} className="text-gray-500 hover:text-gray-800">
                          {p.figureImageId ? "그림 다시 자르기" : "그림 넣기"}
                        </button>
                      )}
                      {p.figureImageId && (
                        <button onClick={() => removeFigure(p.id)} className="text-gray-500 hover:text-gray-800">
                          그림 빼기
                        </button>
                      )}
                      <button onClick={() => remove(p.id)} className="text-red-400 hover:text-red-600">
                        삭제
                      </button>
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed">
                    <MathText text={p.problemLatex} />
                  </div>
                  {p.figureImageId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/math-images/${p.figureImageId}`}
                      alt="문제 그림"
                      className="max-h-56 border border-gray-100 rounded"
                      loading="lazy"
                    />
                  )}
                  {showOriginal[p.id] && p.cropImageId && (
                    <div className="border border-dashed border-gray-300 rounded p-2">
                      <p className="text-xs text-gray-400 mb-1">원본(인식이 맞는지 비교용)</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/math-images/${p.cropImageId}`} alt="원본 문제" className="max-h-96" loading="lazy" />
                    </div>
                  )}
                  {p.answer && (
                    <p className="text-xs text-gray-500">
                      정답: <MathText text={p.answer} />
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 선택 바 */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-800">{selected.length}개 선택</span>
            <button onClick={() => setSelected([])} className="text-xs text-gray-500 hover:text-gray-800">
              선택 비우기
            </button>
            <button
              onClick={removeSelected}
              disabled={bulkDeleting}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              {bulkDeleting ? "삭제 중..." : `선택한 ${selected.length}개 삭제`}
            </button>
            <button
              onClick={() => setMakingSheet(true)}
              className="ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800"
            >
              학습지 만들기
            </button>
          </div>
        </div>
      )}

      {editing && (
        <MathProblemEditor problem={editing} units={facets.units} onClose={() => setEditing(null)} onSaved={load} />
      )}

      {cropping?.cropImageId && (
        <FigureCropper
          problemId={cropping.id}
          cropImageId={cropping.cropImageId}
          onClose={() => setCropping(null)}
          onSaved={load}
        />
      )}

      {makingSheet && (
        <MakeWorksheet
          ids={selected}
          info={selectedInfo}
          defaultGrade={fGrade || uploadGrade}
          defaultTitle={`${fSource || source || "수학"} 학습지`}
          onReorder={setSelected}
          onClose={() => setMakingSheet(false)}
          onCreated={(worksheetId) => {
            setSelected([]);
            router.push(`/worksheets/${worksheetId}/print`);
          }}
        />
      )}
    </div>
  );
}

// 학습지 만들기 창: 제목·학년, 순서 바꾸기, 빠진 정답 채우기
function MakeWorksheet({
  ids,
  info,
  defaultGrade,
  defaultTitle,
  onReorder,
  onClose,
  onCreated,
}: {
  ids: string[];
  info: Record<string, MathProblem>;
  defaultGrade: string;
  defaultTitle: string;
  onReorder: (ids: string[]) => void;
  onClose: () => void;
  onCreated: (worksheetId: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [grade, setGrade] = useState(defaultGrade);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    // 객관식은 선지 번호(①~⑤)로 맞춰 보여 준다(채점 형식과 같게)
    Object.fromEntries(
      ids.map((id) => {
        const p = info[id];
        const latex = p?.problemLatex ?? "";
        return [id, p?.answer ? answerFromStoredValue(p.answer, detectChoicesCount(latex), latex) : ""];
      })
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const missing = ids.filter((id) => !(answers[id] ?? "").trim());
  const unknown = ids.filter((id) => !info[id]);

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  }

  async function create() {
    setError("");
    if (!title.trim()) return setError("학습지 제목을 입력해 주세요.");
    if (missing.length > 0) return setError(`정답이 비어 있는 문제가 ${missing.length}개 있어요. 채워 주세요(채점에 필요).`);
    setSaving(true);
    try {
      const res = await fetch("/api/worksheets/from-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          grade: grade || undefined,
          items: ids.map((id) => ({ mathProblemId: id, answer: answers[id].trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "학습지를 만들지 못했어요.");
      onCreated(data.worksheet.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="학습지 만들기"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">학습지 만들기 · {ids.length}문제</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            id="ws-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="학습지 제목"
            className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select id="ws-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">학년 없음</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500">
          채점에 쓰일 정답을 확인·입력해 주세요(빨간 칸은 비어 있음). 객관식은 선지 번호로 적어요(3 → ③).
        </p>
        {unknown.length > 0 && (
          <p className="text-xs text-amber-700">
            선택한 문제 중 {unknown.length}개는 지금 목록에 없어 미리보기가 없어요(필터를 풀면 보여요). 그대로 만들 수 있어요.
          </p>
        )}
        <ol className="space-y-2">
          {ids.map((id, i) => {
            const p = info[id];
            const empty = !(answers[id] ?? "").trim();
            return (
              <li key={id} className="flex items-start gap-2 border border-gray-100 rounded-lg p-2">
                <span className="w-7 text-sm font-bold text-gray-700 pt-1">{i + 1}.</span>
                <div className="flex-1 min-w-0 text-xs text-gray-700 line-clamp-2">
                  {p ? <MathText text={p.problemLatex.slice(0, 160)} /> : <span className="text-gray-400">(미리보기 없음)</span>}
                </div>
                {(() => {
                  // 객관식이면 저장될 선지 번호를 바로 보여 준다(“3” → ③)
                  const latex = p?.problemLatex ?? "";
                  const cc = detectChoicesCount(latex);
                  const v = (answers[id] ?? "").trim();
                  const shown = cc && v ? normalizeAnswer(v, cc) : "";
                  return shown && shown !== v ? <span className="text-xs text-emerald-700 pt-1">→ {shown}</span> : null;
                })()}
                <input
                  id={`ws-ans-${id}`}
                  value={answers[id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [id]: e.target.value }))}
                  placeholder="정답"
                  aria-label={`${i + 1}번 정답`}
                  className={`w-20 border rounded px-2 py-1 text-xs ${empty ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                />
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1 disabled:opacity-30" aria-label="위로">
                    ▲
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} className="text-xs px-1 disabled:opacity-30" aria-label="아래로">
                    ▼
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            닫기
          </button>
          <button
            onClick={create}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "만드는 중..." : "만들고 인쇄 화면으로"}
          </button>
        </div>
      </div>
    </div>
  );
}
