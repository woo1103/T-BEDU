"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseVocabText, partsOf, rowsToVocab, splitIntoParts, type VocabRow } from "@/lib/vocab";
import { openPages, pageToJpeg } from "@/lib/page-images";

interface ClassRow {
  id: string;
  name: string;
}
interface Progress {
  total: number;
  classes: {
    id: string;
    name: string;
    students: { id: string; name: string; studied: number; known: number; correct: number; wrong: number; last: string | null }[];
  }[];
  topWrong: { id: string; word: string; meaning: string; wrong: number }[];
}

const GRADES = ["", "중1", "중2", "중3", "고1", "고2", "고3"];

// 단어 세트 만들기·고치기 (id가 "new"면 새 세트)
export default function VocabSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [description, setDescription] = useState("");
  const [words, setWords] = useState<VocabRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");

  // 가져오기
  const [paste, setPaste] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importing, setImporting] = useState("");
  const stopRef = useRef(false);

  // 배정·현황
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [assignMsg, setAssignMsg] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);

  // 시험지
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("");
  const [count, setCount] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [withKey, setWithKey] = useState(true);
  const [printBy, setPrintBy] = useState<"part" | "number">("part");
  const [partFrom, setPartFrom] = useState("1");
  const [partTo, setPartTo] = useState("1");
  const [splitSize, setSplitSize] = useState("20");

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const res = await fetch(`/api/vocab-sets/${id}`);
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) {
        setMsg(d?.error || "세트를 불러오지 못했어요");
        setLoading(false);
        return;
      }
      setTitle(d.title);
      setGrade(d.grade ?? "");
      setDescription(d.description ?? "");
      setWords(d.words.map((w: VocabRow & { id: string }) => ({ id: w.id, part: w.part, word: w.word, meaning: w.meaning, example: w.example })));
      setAssigned(d.classIds ?? []);
      setTo(String(d.words.length || ""));
      setLoading(false);
    })();
    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => setClasses((d.classes ?? []).map((c: ClassRow) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    fetch(`/api/vocab-sets/${id}/progress`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProgress(d))
      .catch(() => {});
  }, [id, isNew]);

  // 저장 안 한 변경이 있으면 창을 닫기 전에 묻는다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function applyImport(rows: VocabRow[], label: string) {
    if (rows.length === 0) {
      setMsg(`${label}에서 단어를 찾지 못했어요. 1열=단어, 2열=뜻 모양인지 확인해 주세요.`);
      return;
    }
    setWords((cur) => {
      if (importMode === "replace") return rows;
      // 덧붙일 때: 범위가 적힌 파일이면 기존 마지막 범위 뒤로 이어 붙이고(1,2 → 기존이 3까지면 4,5), 없으면 마지막 범위에 넣는다
      const last = cur.reduce((m, w) => Math.max(m, w.part ?? 1), 0);
      const hasParts = rows.some((r) => r.part);
      return [...cur, ...rows.map((r) => ({ ...r, part: hasParts ? (r.part ?? 1) + last : Math.max(1, last) }))];
    });
    setDirty(true);
    const np = partsOf(rows).length;
    setMsg(`${label}에서 단어 ${rows.length}개${rows.some((r) => r.part) ? `(범위 ${np}개)` : ""}를 ${importMode === "replace" ? "새로 채웠어요" : "아래에 덧붙였어요"}. 확인 후 저장하세요.`);
  }

  async function onExcel(file: File) {
    try {
      if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        applyImport(parseVocabText(await file.text()), file.name);
        return;
      }
      const readXlsxFile = (await import("read-excel-file")).default;
      const rows = await readXlsxFile(file);
      applyImport(rowsToVocab(rows as unknown[][]), file.name);
    } catch (e) {
      setMsg(`엑셀 파일을 읽지 못했어요: ${e instanceof Error ? e.message : e}`);
    }
  }

  // PDF·사진: 쪽마다 AI가 단어·뜻을 읽는다(실패한 쪽은 건너뛰고 알려 줌)
  async function onPdf(file: File) {
    stopRef.current = false;
    const found: VocabRow[] = [];
    const failed: number[] = [];
    try {
      setImporting("파일 여는 중...");
      const doc = await openPages(file);
      for (let page = 1; page <= doc.count; page++) {
        if (stopRef.current) break;
        setImporting(`쪽 ${page}/${doc.count} 읽는 중 · 지금까지 ${found.length}단어`);
        try {
          const img = pageToJpeg(await doc.render(page));
          const res = await fetch("/api/vocab/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: img.base64, mediaType: img.mime }),
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.error || "실패");
          found.push(...(d.words as VocabRow[]));
        } catch {
          failed.push(page);
        }
      }
      applyImport(found, file.name);
      if (failed.length) setMsg((m) => `${m} (읽지 못한 쪽: ${failed.join(", ")})`);
    } catch (e) {
      setMsg(`PDF를 열지 못했어요: ${e instanceof Error ? e.message : e}`);
    } finally {
      setImporting("");
    }
  }

  function downloadTemplate() {
    const csv = "\uFEFF범위,단어,뜻,예문(선택)\n1,abandon,버리다,He abandoned the plan.\n1,benefit,이익; 혜택,\n2,consider,고려하다,\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "단어세트_양식.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function setPart(i: number, v: string) {
    const n = Math.max(1, Math.floor(Number(v) || 1));
    setWords((ws) => ws.map((w, j) => (j === i ? { ...w, part: n } : w)));
    setDirty(true);
  }

  function update(i: number, field: "word" | "meaning" | "example", v: string) {
    setWords((ws) => ws.map((w, j) => (j === i ? { ...w, [field]: v } : w)));
    setDirty(true);
  }

  async function save() {
    if (!title.trim()) return alert("세트 이름을 적어 주세요.");
    const clean = words.filter((w) => w.word.trim() && w.meaning.trim());
    if (clean.length === 0) return alert("단어를 하나 이상 넣어 주세요.");
    if (clean.length < words.length && !confirm(`단어나 뜻이 빈 줄 ${words.length - clean.length}개는 빼고 저장할까요?`)) return;
    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/vocab-sets" : `/api/vocab-sets/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, grade, description, words: clean }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return alert(d.error || "저장 실패");
      setDirty(false);
      if (isNew) {
        router.replace(`/vocab/${d.id}`);
        return;
      }
      // 새로 생긴 단어의 id를 받으려고 다시 불러온다
      const fresh = await (await fetch(`/api/vocab-sets/${id}`)).json();
      setWords(fresh.words.map((w: VocabRow & { id: string }) => ({ id: w.id, part: w.part, word: w.word, meaning: w.meaning, example: w.example })));
      setMsg(`저장했어요 · 단어 ${fresh.words.length}개`);
    } finally {
      setSaving(false);
    }
  }

  async function saveAssign(next: string[]) {
    setAssigned(next);
    const res = await fetch(`/api/vocab-sets/${id}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classIds: next }),
    });
    setAssignMsg(res.ok ? "배정을 저장했어요" : "배정 저장 실패");
  }

  function openPrint() {
    const n = words.length;
    const f = Math.max(1, Math.min(n, Number(from) || 1));
    const t = Math.max(f, Math.min(n, Number(to) || n));
    const sp = new URLSearchParams({ shuffle: shuffle ? "1" : "0", key: withKey ? "1" : "0" });
    if (printBy === "part") {
      sp.set("partFrom", partFrom);
      sp.set("partTo", String(Math.max(Number(partFrom), Number(partTo))));
    } else {
      sp.set("from", String(f));
      sp.set("to", String(t));
    }
    if (count.trim()) sp.set("count", String(Math.max(1, Number(count) || 0)));
    if (shuffle) sp.set("seed", String(Date.now() % 1_000_000));
    window.open(`/vocab/${id}/print?${sp}`, "_blank");
  }

  if (loading) return <p className="text-sm text-gray-400">불러오는 중...</p>;

  return (
    <div className="max-w-5xl space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Link href="/vocab" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; 단어 세트 목록
        </Link>
        <h2 className="text-lg font-semibold text-gray-800">{isNew ? "새 단어 세트" : title || "단어 세트"}</h2>
      </div>

      {/* 세트 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="세트 이름 (예: 고1 수능 필수 영단어 Day 1~10)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          aria-label="세트 이름"
        />
        <select value={grade} onChange={(e) => { setGrade(e.target.value); setDirty(true); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" aria-label="학년">
          {GRADES.map((g) => <option key={g} value={g}>{g || "학년 선택"}</option>)}
        </select>
        <input
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
          placeholder="메모 (선택)"
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          aria-label="메모"
        />
      </div>

      {/* 가져오기 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold text-gray-800 mr-auto">단어 가져오기</h3>
          <label className="text-xs text-gray-600 flex items-center gap-1">
            <input type="radio" checked={importMode === "append"} onChange={() => setImportMode("append")} /> 아래에 덧붙이기
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-1">
            <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} /> 새로 채우기
          </label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700">
            📊 엑셀·CSV 파일
            <input type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onExcel(f); e.target.value = ""; }} />
          </label>
          <label className={`px-3 py-2 text-sm rounded-lg cursor-pointer ${importing ? "bg-purple-200 text-purple-500" : "bg-purple-600 text-white hover:bg-purple-700"}`}>
            📄 PDF·사진 (AI로 읽기)
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" disabled={!!importing} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = ""; }} />
          </label>
          {importing && (
            <button onClick={() => (stopRef.current = true)} className="px-3 py-2 text-sm rounded-lg border border-gray-300">
              이번 쪽까지만
            </button>
          )}
          <button onClick={downloadTemplate} className="text-xs text-gray-500 underline hover:text-gray-800">
            엑셀 양식 내려받기
          </button>
        </div>
        {importing && <p className="text-xs text-purple-700">{importing}</p>}
        <p className="text-xs text-gray-400">엑셀은 1열=단어, 2열=뜻, 3열=예문(선택). 맨 앞에 범위 열(1, 1, 2, 2… 또는 Day 1)을 두면 범위별로 나눠져요. 첫 줄이 머리글이어도 괜찮아요.</p>
        <div className="flex gap-2 items-start">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={3}
            placeholder={"붙여 넣기: 한 줄에 하나씩 (엑셀에서 복사하거나 \"abandon, 버리다\" 모양)"}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            aria-label="단어 붙여 넣기"
          />
          <button
            onClick={() => { applyImport(parseVocabText(paste), "붙여 넣은 글"); setPaste(""); }}
            disabled={!paste.trim()}
            className="px-3 py-2 text-sm rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            넣기
          </button>
        </div>
        {msg && <p className="text-sm text-emerald-800">{msg}</p>}
      </div>

      {/* 단어 표 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">
            단어 {words.length}개 <span className="text-sm font-normal text-gray-500">· 범위 {partsOf(words).length}개</span>
          </h3>
          {words.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <input value={splitSize} onChange={(e) => setSplitSize(e.target.value.replace(/\D/g, ""))} className="w-12 border border-gray-300 rounded px-1.5 py-1" inputMode="numeric" aria-label="범위당 단어 수" />
              단어씩
              <button
                onClick={() => {
                  const n = Number(splitSize) || 0;
                  if (n < 1) return;
                  if (!confirm(`지금 범위를 지우고 ${n}단어씩 1, 2, 3… 범위로 나눌까요?`)) return;
                  setWords((ws) => splitIntoParts(ws, n));
                  setDirty(true);
                }}
                className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                범위 나누기
              </button>
            </span>
          )}
          {words.length > 0 && (
            <button onClick={() => { if (confirm("단어를 모두 지울까요? (저장해야 반영돼요)")) { setWords([]); setDirty(true); } }} className="text-xs text-gray-400 hover:text-red-500">
              모두 지우기
            </button>
          )}
          <button onClick={save} disabled={saving} className="ml-auto px-4 py-2 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50">
            {saving ? "저장 중..." : dirty || isNew ? "저장" : "저장됨"}
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="w-12 py-2">번호</th>
                <th className="w-16 py-2">범위</th>
                <th className="text-left py-2">단어</th>
                <th className="text-left py-2">뜻</th>
                <th className="text-left py-2 hidden md:table-cell">예문</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={w.id ?? `n${i}`} className={`border-t ${i > 0 && (words[i - 1].part ?? 1) !== (w.part ?? 1) ? "border-t-2 border-emerald-300" : "border-gray-50"}`}>
                  <td className="text-center text-xs text-gray-400">{i + 1}</td>
                  <td className="py-1 px-1">
                    <input value={w.part ?? 1} onChange={(e) => setPart(i, e.target.value)} inputMode="numeric" className="w-full text-center border border-transparent hover:border-gray-200 focus:border-emerald-400 rounded px-1 py-1 text-xs" aria-label={`${i + 1}번 범위`} />
                  </td>
                  <td className="py-1 pr-2"><input value={w.word} onChange={(e) => update(i, "word", e.target.value)} className="w-full border border-transparent hover:border-gray-200 focus:border-emerald-400 rounded px-2 py-1" aria-label={`${i + 1}번 단어`} /></td>
                  <td className="py-1 pr-2"><input value={w.meaning} onChange={(e) => update(i, "meaning", e.target.value)} className="w-full border border-transparent hover:border-gray-200 focus:border-emerald-400 rounded px-2 py-1" aria-label={`${i + 1}번 뜻`} /></td>
                  <td className="py-1 pr-2 hidden md:table-cell"><input value={w.example ?? ""} onChange={(e) => update(i, "example", e.target.value)} className="w-full border border-transparent hover:border-gray-200 focus:border-emerald-400 rounded px-2 py-1 text-xs text-gray-500" aria-label={`${i + 1}번 예문`} /></td>
                  <td className="text-center">
                    <button onClick={() => { setWords((ws) => ws.filter((_, j) => j !== i)); setDirty(true); }} className="text-gray-300 hover:text-red-500" aria-label={`${i + 1}번 지우기`}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => { setWords((ws) => [...ws, { word: "", meaning: "", part: ws[ws.length - 1]?.part ?? 1 }]); setDirty(true); }} className="text-sm text-emerald-700 hover:underline">
            + 한 줄 추가
          </button>
        </div>
      </div>

      {!isNew && (
        <>
          {/* 반 배정 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">반에 배정 <span className="text-xs font-normal text-gray-400">체크하면 그 반 학생 앱에 이 세트가 나와요</span></h3>
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400">반이 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => {
                  const on = assigned.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => saveAssign(on ? assigned.filter((x) => x !== c.id) : [...assigned, c.id])}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${on ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                      aria-pressed={on}
                    >
                      {on ? "✓ " : ""}{c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {assignMsg && <p className="text-xs text-emerald-700">{assignMsg}</p>}
          </div>

          {/* 시험지 */}
          <div id="print" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">단어 시험지 만들기 <span className="text-xs font-normal text-gray-400">영어 → 뜻 쓰기</span></h3>
            {dirty && <p className="text-xs text-amber-700">저장하지 않은 변경이 있어요. 시험지는 저장된 단어로 만들어져요.</p>}
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="radio" checked={printBy === "part"} onChange={() => setPrintBy("part")} /> 범위로</label>
              <label className="flex items-center gap-1"><input type="radio" checked={printBy === "number"} onChange={() => setPrintBy("number")} /> 단어 번호로</label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {printBy === "part" ? (
                <>
                  범위
                  <select value={partFrom} onChange={(e) => { setPartFrom(e.target.value); if (Number(partTo) < Number(e.target.value)) setPartTo(e.target.value); }} className="border border-gray-300 rounded-lg px-2 py-1.5" aria-label="시작 범위">
                    {partsOf(words).map((p) => <option key={p.part} value={p.part}>{p.part}</option>)}
                  </select>
                  ~
                  <select value={partTo} onChange={(e) => setPartTo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5" aria-label="끝 범위">
                    {partsOf(words).filter((p) => p.part >= Number(partFrom)).map((p) => <option key={p.part} value={p.part}>{p.part}</option>)}
                  </select>
                  ({words.filter((w) => (w.part ?? 1) >= Number(partFrom) && (w.part ?? 1) <= Number(partTo)).length}단어) 중
                </>
              ) : (
                <>
              <input value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} className="w-16 border border-gray-300 rounded-lg px-2 py-1.5" inputMode="numeric" aria-label="시작 번호" />
              번부터
              <input value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} className="w-16 border border-gray-300 rounded-lg px-2 py-1.5" inputMode="numeric" aria-label="끝 번호" />
              번까지 중
                </>
              )}
              <input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} placeholder="전부" className="w-16 border border-gray-300 rounded-lg px-2 py-1.5" inputMode="numeric" aria-label="문항 수" />
              문항
              <label className="flex items-center gap-1 ml-2"><input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> 순서 섞기</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} /> 답지 함께</label>
              <button onClick={openPrint} disabled={words.length === 0} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
                시험지 열기 (인쇄)
              </button>
            </div>
            <p className="text-xs text-gray-400">순서 섞기를 켜면 열 때마다 순서가 바뀌어요. 답지는 같은 순서로 뒤쪽에 붙어요. 문항 수를 적으면 범위 안에서 그만큼만 골라요.</p>
          </div>

          {/* 학습 현황 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">학습 현황</h3>
            {!progress ? (
              <p className="text-sm text-gray-400">불러오는 중...</p>
            ) : progress.classes.length === 0 ? (
              <p className="text-sm text-gray-400">반에 배정하면 학생별 현황이 보여요.</p>
            ) : (
              <div className="grid md:grid-cols-[1fr_16rem] gap-4">
                <div className="space-y-4">
                  {progress.classes.map((c) => (
                    <div key={c.id}>
                      <p className="text-sm font-medium text-gray-700 mb-1">{c.name}</p>
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-400">
                          <tr><th className="text-left">학생</th><th>외운 단어</th><th>본 단어</th><th>맞힘/틀림</th><th>마지막 학습</th></tr>
                        </thead>
                        <tbody>
                          {c.students.map((s) => (
                            <tr key={s.id} className="border-t border-gray-50">
                              <td className="py-1">{s.name}</td>
                              <td className="text-center">
                                <span className={s.known >= progress.total && progress.total > 0 ? "text-emerald-700 font-medium" : ""}>{s.known}/{progress.total}</span>
                              </td>
                              <td className="text-center text-gray-500">{s.studied}</td>
                              <td className="text-center text-gray-500">{s.correct}/{s.wrong}</td>
                              <td className="text-center text-xs text-gray-400">{s.last ? new Date(s.last).toLocaleDateString("ko-KR") : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">자주 틀린 단어</p>
                  {progress.topWrong.length === 0 ? (
                    <p className="text-xs text-gray-400">아직 없어요.</p>
                  ) : (
                    <ol className="text-sm space-y-0.5">
                      {progress.topWrong.map((w) => (
                        <li key={w.id} className="flex gap-2"><b>{w.word}</b><span className="text-gray-500 truncate">{w.meaning}</span><span className="ml-auto text-xs text-red-500">{w.wrong}회</span></li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
