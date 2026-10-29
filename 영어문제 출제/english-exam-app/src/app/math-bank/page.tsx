"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MathText from "@/components/MathText";
import FigureCropper from "@/components/math/FigureCropper";
import MathProblemEditor from "@/components/math/MathProblemEditor";
import { cropToJpeg, openPages, pageToJpeg } from "@/lib/page-images";
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
}

type Box = [number, number, number, number];

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];
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

  // 필터
  const [fGrade, setFGrade] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fSource, setFSource] = useState("");
  const [fDiff, setFDiff] = useState("");
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
  }, [fGrade, fUnit, fSource, fDiff]);

  // 쪽마다: 쪽 이미지 인식 → 문항 저장 → 각 문항 영역·그림을 잘라 저장
  async function onFile(file: File) {
    setIngesting(true);
    stopRef.current = false;
    let saved = 0;
    let imagesFailed = 0;
    try {
      setIngestLog("파일 여는 중...");
      const doc = await openPages(file);
      for (let page = 1; page <= doc.count; page++) {
        if (stopRef.current) break;
        setIngestLog(`쪽 ${page}/${doc.count} 인식 중 · 지금까지 문제 ${saved}개 저장`);
        const canvas = await doc.render(page);
        const img = pageToJpeg(canvas);
        const res = await fetch("/api/math-problems/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: img.base64,
            mediaType: img.mime,
            source: source || undefined,
            sourceType,
            grade: uploadGrade || undefined,
            page,
          }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(`쪽 ${page}: ${r.error || "인식 실패"}`);
        const created = r.problems as (MathProblem & { box: Box | null; figureBox: Box | null })[];
        saved += created.length;
        await Promise.all(
          created.map(async (p) => {
            if (!p.box && !p.figureBox) return;
            const body: Record<string, unknown> = {};
            if (p.box) body.crop = cropToJpeg(canvas, p.box);
            // 그림 좌표는 몇 % 빗나갈 수 있음: 여유가 작으면 그림이 잘리고 크면 주변 글자가 들어온다 → 2%로 절충,
            // 어긋나면 목록의 "그림 다시 자르기"로 바로잡는다
            if (p.figureBox) body.figure = cropToJpeg(canvas, p.figureBox, 0.02);
            const ir = await fetch(`/api/math-problems/${p.id}/images`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!ir.ok) imagesFailed++;
          })
        );
      }
      setIngestLog(
        (stopRef.current ? "멈춤 · " : "완료 · ") +
          `문제 ${saved}개 저장` +
          (imagesFailed > 0 ? ` (그림 저장 실패 ${imagesFailed}건 — 글자는 저장됨)` : "")
      );
      await load();
    } catch (e) {
      setIngestLog(`${e instanceof Error ? e.message : "오류"} · 그 전까지 문제 ${saved}개는 저장됨`);
      await load();
    } finally {
      setIngesting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 문제를 은행에서 삭제할까요?")) return;
    const res = await fetch(`/api/math-problems/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSelected((s) => s.filter((x) => x !== id));
      await load();
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
          기출·교재 PDF나 사진을 올리면 쪽마다 AI가 문항을 나누고 수식을 인식해 저장합니다. 그래프·도형은 그림으로 잘라 함께
          저장해요. 문제를 골라 학습지를 만들고 2분할·4분할로 인쇄할 수 있습니다.
        </p>
      </div>

      {/* 업로드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800">문제 업로드 (자동 수집)</h3>
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
          {ingesting && (
            <button
              onClick={() => (stopRef.current = true)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              이번 쪽까지만 하고 멈추기
            </button>
          )}
        </div>
        {ingestLog && <p className="text-xs text-gray-600">{ingestLog}</p>}
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
