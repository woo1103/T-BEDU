"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openPages, pageToJpeg } from "@/lib/page-images";
import { addPage, joinParts, wordCount, type DraftPassage } from "@/lib/passage-import";

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];
const DRAFT_KEY = "passage-import-draft";

interface Draft {
  textbook: string;
  grade: string;
  defaultLesson: string;
  items: DraftPassage[];
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

// 교재 PDF(또는 쪽 사진) → AI가 쪽마다 영어 지문을 옮겨 적음 → 선생님이 고치고 골라서 저장
export default function PassageImportPage() {
  const router = useRouter();
  const [textbook, setTextbook] = useState("");
  const [grade, setGrade] = useState("고1");
  const [defaultLesson, setDefaultLesson] = useState("");
  const [items, setItems] = useState<DraftPassage[]>([]);
  const [reading, setReading] = useState(false);
  const [log, setLog] = useState("");
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const stopRef = useRef(false);

  // 고치던 목록은 이 브라우저에 임시로 남겨 둔다(새로 고침·실수로 나가도 이어서)
  useEffect(() => {
    const d = loadDraft();
    // 저장해 둔 임시 목록 복원(처음 한 번)
    if (d && d.items.length) {
      setTextbook(d.textbook);
      setGrade(d.grade);
      setDefaultLesson(d.defaultLesson);
      setItems(d.items);
      setRestored(true);
    }
  }, []);
  useEffect(() => {
    try {
      if (items.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ textbook, grade, defaultLesson, items }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* 저장 못 해도 화면은 그대로 */
    }
  }, [textbook, grade, defaultLesson, items]);

  async function onFile(file: File) {
    setReading(true);
    stopRef.current = false;
    let found = 0;
    try {
      setLog("파일 여는 중...");
      const doc = await openPages(file);
      for (let page = 1; page <= doc.count; page++) {
        if (stopRef.current) break;
        setLog(`${page}/${doc.count}쪽 읽는 중 · 지금까지 지문 ${found}개`);
        const img = pageToJpeg(await doc.render(page));
        const res = await fetch("/api/passages/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: img.base64, mediaType: img.mime }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(`${page}쪽: ${r.error || "읽기 실패"}`);
        found += r.passages.filter((p: { continued: boolean }, i: number) => !(i === 0 && p.continued)).length;
        setItems((prev) => addPage(prev, page, r.passages, defaultLesson.trim()));
      }
      setLog(`${stopRef.current ? "멈춤" : "다 읽었어요"} · 지문 ${found}개 — 아래에서 확인·수정한 뒤 저장하세요.`);
    } catch (e) {
      setLog(`${e instanceof Error ? e.message : "오류"} · 그 전까지 읽은 지문은 아래에 있어요.`);
    } finally {
      setReading(false);
    }
  }

  function patch(key: string, p: Partial<DraftPassage>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }

  // AI가 한 지문을 둘로 나눴을 때: 위 지문에 붙이기
  function mergeUp(idx: number) {
    setItems((prev) => {
      if (idx <= 0) return prev;
      const next = [...prev];
      next[idx - 1] = { ...next[idx - 1], content: joinParts(next[idx - 1].content, next[idx].content) };
      next.splice(idx, 1);
      return next;
    });
  }

  async function saveSelected() {
    const chosen = items.filter((it) => it.include);
    if (!textbook.trim()) return alert("교과서명을 적어 주세요.");
    if (chosen.length === 0) return alert("저장할 지문을 1개 이상 고르세요.");
    const noLesson = chosen.filter((it) => !it.lesson.trim()).length;
    if (noLesson) return alert(`과/단원이 비어 있는 지문이 ${noLesson}개 있어요.`);
    setSaving(true);
    let ok = 0;
    try {
      for (const it of chosen) {
        const res = await fetch("/api/passages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ textbook: textbook.trim(), grade, lesson: it.lesson.trim(), title: it.title.trim(), content: it.content }),
        });
        if (!res.ok) throw new Error("저장 실패");
        ok++;
        // 저장한 것은 목록에서 빼서, 중간에 실패해도 다시 누르면 남은 것만 저장된다
        setItems((prev) => prev.filter((x) => x.key !== it.key));
      }
      alert(`지문 ${ok}개를 저장했어요.`);
      router.push("/passages");
    } catch {
      alert(`지문 ${ok}개까지 저장했고, 그다음에서 멈췄어요. 다시 저장을 누르면 남은 지문만 저장돼요.`);
    } finally {
      setSaving(false);
    }
  }

  const chosenCount = items.filter((i) => i.include).length;
  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/passages" className="text-xs text-gray-400 hover:text-gray-600">
          ← 지문 관리
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 mt-1">지문 PDF로 가져오기</h2>
        <p className="text-sm text-gray-500 mt-1">
          교재 PDF나 쪽 사진을 올리면 AI가 쪽마다 영어 지문을 옮겨 적어요. 아래 목록에서 확인·수정하고 골라서 저장하세요.
          (스캔본도 읽어요 · 1쪽에 약 20~40원)
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">교과서명</span>
            <input value={textbook} onChange={(e) => setTextbook(e.target.value)} placeholder="예: 능률 영어I" className={input} />
          </label>
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">학년</span>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className={input}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">과/단원 기본값</span>
            <input
              value={defaultLesson}
              onChange={(e) => setDefaultLesson(e.target.value)}
              placeholder="쪽에 안 보일 때 쓸 값, 예: Lesson 3"
              className={input}
            />
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label
            className={`px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
              reading ? "bg-amber-200 text-amber-600 pointer-events-none" : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            {reading ? "읽는 중..." : "📄 PDF·사진 올리기"}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={reading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onFile(f);
              }}
            />
          </label>
          {reading && (
            <button onClick={() => (stopRef.current = true)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600">
              멈추기
            </button>
          )}
          {log && <span className="text-sm text-gray-600">{log}</span>}
        </div>
        {restored && !reading && (
          <p className="text-xs text-gray-500">지난번에 고치던 목록을 불러왔어요. 새 파일을 올리면 아래에 이어서 붙어요.</p>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">
              지문 {items.length}개 · 저장할 것 {chosenCount}개
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (confirm("목록을 모두 지울까요?")) setItems([]);
                }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600"
              >
                목록 비우기
              </button>
              <button
                onClick={saveSelected}
                disabled={saving || reading || chosenCount === 0}
                className="px-5 py-2 text-sm rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : `고른 지문 ${chosenCount}개 저장`}
              </button>
            </div>
          </div>

          <ol className="space-y-4">
            {items.map((it, idx) => (
              <li
                key={it.key}
                className={`bg-white rounded-xl shadow-sm border p-4 space-y-3 ${it.include ? "border-gray-100" : "border-gray-100 opacity-60"}`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={it.include} onChange={(e) => patch(it.key, { include: e.target.checked })} />
                    {idx + 1}번 지문
                  </label>
                  <span className="text-xs text-gray-400">{it.page}쪽 · {wordCount(it.content)}단어</span>
                  <div className="ml-auto flex gap-3 text-xs">
                    {idx > 0 && (
                      <button onClick={() => mergeUp(idx)} className="text-blue-600 hover:underline" title="AI가 한 지문을 둘로 나눴을 때">
                        위 지문에 붙이기
                      </button>
                    )}
                    <button onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))} className="text-red-500 hover:underline">
                      빼기
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    value={it.lesson}
                    onChange={(e) => patch(it.key, { lesson: e.target.value })}
                    placeholder="과/단원(필수)"
                    className={`${input} ${it.lesson.trim() ? "" : "border-red-300"}`}
                    aria-label={`${idx + 1}번 과/단원`}
                  />
                  <input
                    value={it.title}
                    onChange={(e) => patch(it.key, { title: e.target.value })}
                    placeholder="제목(선택)"
                    className={`${input} sm:col-span-2`}
                    aria-label={`${idx + 1}번 제목`}
                  />
                </div>
                <textarea
                  value={it.content}
                  onChange={(e) => patch(it.key, { content: e.target.value })}
                  rows={Math.min(18, Math.max(5, Math.ceil(it.content.length / 90)))}
                  className={`${input} font-mono leading-relaxed`}
                  aria-label={`${idx + 1}번 지문 내용`}
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
