"use client";

// 시험지 구성 화면(새 시험지·시험지 편집 공용)
//  왼쪽: 문제 카드(발문·지문·선지가 다 보임) — 카드를 누르면 담기/빼기, 지문 단위 "모두 담기"
//  오른쪽: 실제 시험지 모양 미리보기 — 끌어서 순서 바꾸기, 배점 고치기, "고치기"로 문제 은행 원본 수정
import { useMemo, useState } from "react";
import { getQuestionTypeInfo } from "@/lib/question-types";
import { groupSetRuns, withSetMembers } from "@/lib/question-sets";
import { PassageText } from "@/components/PassageText";
import QuestionQuickEdit from "@/components/questions/QuestionQuickEdit";

export interface ComposerQuestion {
  id: string;
  examType: string;
  questionType: string;
  question: string;
  passage: string;
  choices: string;
  answer: string;
  explanation: string | null;
  difficulty: string;
  points: number;
  source: string | null;
  aiGenerated: boolean;
  passageId: string | null;
  createdAt?: string;
  setId?: string | null;
  stats?: { answered: number; correct: number } | null;
  passageRef: { id: string; textbook: string; grade: string; lesson: string; title: string | null } | null;
}

export interface ComposerItem<Q extends ComposerQuestion = ComposerQuestion> {
  questionId: string;
  question: Q;
  orderNum: number;
  customPoints?: number | null;
}

const LABELS = ["①", "②", "③", "④", "⑤"];
const DIFF: Record<string, string> = { easy: "하", medium: "중", hard: "상" };
const PAGE = 20; // 왼쪽에 한 번에 보여 줄 지문 묶음 수

function parseChoices(raw: string): { text: string; isCorrect: boolean }[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((c) => ({ text: String(c?.text ?? ""), isCorrect: !!c?.isCorrect })) : [];
  } catch {
    return [];
  }
}

function typeName(q: ComposerQuestion): string {
  const ti = getQuestionTypeInfo(q.examType, q.questionType);
  return ti ? `${ti.number}번 ${ti.name}` : q.questionType;
}

function renumber<T extends ComposerItem>(items: T[]): T[] {
  return items.map((it, i) => ({ ...it, orderNum: i + 1 }));
}

export default function ExamComposer<Q extends ComposerQuestion>({
  questions,
  items,
  onItemsChange,
  onQuestionUpdated,
  header,
  bankActions,
}: {
  questions: Q[];
  items: ComposerItem<Q>[];
  onItemsChange: (items: ComposerItem<Q>[]) => void;
  onQuestionUpdated: (q: Q) => void; // "고치기"로 은행 원본을 고친 뒤 화면 목록을 바꿔 끼운다
  header: { title: string; school?: string; grade?: string };
  bankActions?: React.ReactNode; // 왼쪽 위 추가 버튼(AI 문제 생성 등)
}) {
  // ── 필터 ──
  const [fGrade, setFGrade] = useState("");
  const [fTextbook, setFTextbook] = useState("");
  const [fLesson, setFLesson] = useState("");
  const [fType, setFType] = useState("");
  const [fDiff, setFDiff] = useState("");
  const [q, setQ] = useState("");
  const [hidePicked, setHidePicked] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [openPassage, setOpenPassage] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const pickedIds = useMemo(() => new Set(items.map((i) => i.questionId)), [items]);

  const facets = useMemo(() => {
    const grades = new Set<string>();
    const textbooks = new Set<string>();
    const lessons = new Set<string>();
    const types = new Map<string, string>();
    for (const x of questions) {
      if (x.passageRef) {
        grades.add(x.passageRef.grade);
        if (!fGrade || x.passageRef.grade === fGrade) textbooks.add(x.passageRef.textbook);
        if ((!fGrade || x.passageRef.grade === fGrade) && (!fTextbook || x.passageRef.textbook === fTextbook))
          lessons.add(x.passageRef.lesson);
      }
      types.set(x.questionType, typeName(x));
    }
    const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
    return {
      grades: sort(grades),
      textbooks: sort(textbooks),
      lessons: sort(lessons),
      types: [...types].sort((a, b) => a[1].localeCompare(b[1], "ko", { numeric: true })),
    };
  }, [questions, fGrade, fTextbook]);

  // 지문 단위 묶음(같은 지문에서 만든 문제끼리). 지문 연결이 없으면 문제 하나가 한 묶음
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = questions.filter((x) => {
      const p = x.passageRef;
      if (fGrade && p?.grade !== fGrade) return false;
      if (fTextbook && p?.textbook !== fTextbook) return false;
      if (fLesson && p?.lesson !== fLesson) return false;
      if (fType && x.questionType !== fType) return false;
      if (fDiff && x.difficulty !== fDiff) return false;
      if (hidePicked && pickedIds.has(x.id)) return false;
      if (term && !x.question.toLowerCase().includes(term) && !x.passage.toLowerCase().includes(term)) return false;
      return true;
    });
    const map = new Map<string, { key: string; label: string; qs: Q[] }>();
    for (const x of filtered) {
      const key = x.passageRef ? `p:${x.passageRef.id}` : `q:${x.id}`;
      if (!map.has(key)) {
        const p = x.passageRef;
        const label = p ? `${p.grade} · ${p.textbook} · ${p.lesson} · ${p.title || `지문 ${p.id.slice(-4)}`}` : "지문 미연결";
        map.set(key, { key, label, qs: [] });
      }
      map.get(key)!.qs.push(x);
    }
    return { list: [...map.values()], count: filtered.length };
  }, [questions, fGrade, fTextbook, fLesson, fType, fDiff, q, hidePicked, pickedIds]);

  // ── 담기·빼기 ──
  function add(qs: Q[]) {
    const expanded = withSetMembers(qs, [...questions, ...qs]);
    const toAdd = expanded.filter((x) => !pickedIds.has(x.id));
    if (toAdd.length === 0) return;
    onItemsChange(renumber([...items, ...toAdd.map((x) => ({ questionId: x.id, question: x, orderNum: 0 }))]));
  }
  function remove(id: string) {
    const setId = items.find((i) => i.questionId === id)?.question.setId;
    onItemsChange(renumber(items.filter((i) => i.questionId !== id && !(setId && i.question.setId === setId))));
  }
  function toggle(x: Q) {
    if (pickedIds.has(x.id)) remove(x.id);
    else add([x]);
  }
  function setPoints(id: string, v: string) {
    const n = Number(v);
    onItemsChange(items.map((i) => (i.questionId === id ? { ...i, customPoints: v === "" || !Number.isFinite(n) ? null : n } : i)));
  }

  // ── 끌어서 순서 바꾸기: 장문 세트는 묶음째 움직인다 ──
  const runs = groupSetRuns(items);
  const runStarts: number[] = [];
  {
    let i = 0;
    for (const r of runs) {
      runStarts.push(i);
      i += r.items.length;
    }
  }
  function runOf(index: number): number {
    let r = runStarts.length - 1;
    while (r > 0 && runStarts[r] > index) r--;
    return r;
  }
  function moveRun(fromRun: number, toRun: number) {
    if (fromRun === toRun) return;
    const blocks = runs.map((r) => r.items);
    const [moved] = blocks.splice(fromRun, 1);
    blocks.splice(toRun > fromRun ? toRun - 1 : toRun, 0, moved);
    onItemsChange(renumber(blocks.flat()));
  }

  const total = items.reduce((s, i) => s + (i.customPoints || i.question.points), 0);
  const visible = groups.list.slice(0, limit);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* ───── 왼쪽: 문제 카드 ───── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800 mr-auto">
              문제 은행 <span className="text-sm font-normal text-gray-500">({groups.count}문제)</span>
            </h3>
            {bankActions}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={fGrade} onChange={(e) => { setFGrade(e.target.value); setFTextbook(""); setFLesson(""); setLimit(PAGE); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" aria-label="학년">
              <option value="">학년 전체</option>
              {facets.grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={fTextbook} onChange={(e) => { setFTextbook(e.target.value); setFLesson(""); setLimit(PAGE); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs max-w-[10rem]" aria-label="교재">
              <option value="">교재 전체</option>
              {facets.textbooks.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={fLesson} onChange={(e) => { setFLesson(e.target.value); setLimit(PAGE); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" aria-label="과">
              <option value="">과 전체</option>
              {facets.lessons.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={fType} onChange={(e) => { setFType(e.target.value); setLimit(PAGE); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs max-w-[11rem]" aria-label="유형">
              <option value="">유형 전체</option>
              {facets.types.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <select value={fDiff} onChange={(e) => { setFDiff(e.target.value); setLimit(PAGE); }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" aria-label="난이도">
              <option value="">난이도 전체</option>
              <option value="easy">하</option>
              <option value="medium">중</option>
              <option value="hard">상</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
              placeholder="발문·지문 검색"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
            />
            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input type="checkbox" checked={hidePicked} onChange={(e) => setHidePicked(e.target.checked)} />
              담은 문제 숨기기
            </label>
          </div>
          <p className="text-[11px] text-gray-400">카드를 누르면 오른쪽 시험지에 담기고, 한 번 더 누르면 빠져요.</p>
        </div>

        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3 space-y-4">
          {visible.length === 0 && <p className="text-sm text-gray-400 text-center py-10">조건에 맞는 문제가 없어요.</p>}
          {visible.map((g) => {
            const addable = g.qs.filter((x) => !pickedIds.has(x.id));
            return (
              <section key={g.key} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-white/95 backdrop-blur py-1 z-10">
                  <span className="text-xs font-medium text-emerald-800 truncate">{g.label}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{g.qs.length}문제</span>
                  {g.qs.length > 1 && addable.length > 0 && (
                    <button onClick={() => add(addable)} className="ml-auto shrink-0 text-xs px-2 py-0.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50">
                      이 지문 {addable.length}문제 모두 담기
                    </button>
                  )}
                </div>
                {g.qs.map((x) => {
                  const picked = pickedIds.has(x.id);
                  const order = picked ? items.find((i) => i.questionId === x.id)?.orderNum : undefined;
                  const choices = parseChoices(x.choices);
                  const open = openPassage.has(x.id);
                  const rate = x.stats && x.stats.answered >= 3 ? Math.round((x.stats.correct / x.stats.answered) * 100) : null;
                  return (
                    <article
                      key={x.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={picked}
                      onClick={() => toggle(x)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(x); } }}
                      className={`rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                        picked ? "border-blue-400 bg-blue-50/60 ring-1 ring-blue-200" : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap text-xs mb-1.5">
                        {picked ? (
                          <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white">{order}번에 담음</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded border border-gray-300 text-gray-500">+ 담기</span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">{typeName(x)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{DIFF[x.difficulty] ?? x.difficulty} · {x.points}점</span>
                        {x.aiGenerated && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-500">AI</span>}
                        {rate !== null && <span className={`px-1.5 py-0.5 rounded ${rate < 50 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}`}>정답률 {rate}%</span>}
                      </div>
                      <p className="font-medium text-gray-800">{x.question}</p>
                      {x.passage.trim() && (
                        <div className="mt-1.5">
                          <div className={`text-xs text-gray-600 leading-relaxed whitespace-pre-wrap ${open ? "" : "line-clamp-3"}`}>
                            <PassageText text={x.passage} />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenPassage((s) => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; }); }}
                            className="text-[11px] text-blue-600 hover:underline mt-0.5"
                          >
                            {open ? "지문 접기" : "지문 펼치기"}
                          </button>
                        </div>
                      )}
                      {choices.length > 0 && (
                        <ol className="mt-1.5 space-y-0.5 text-xs text-gray-700">
                          {choices.map((c, i) => (
                            <li key={i} className={c.isCorrect ? "text-emerald-700 font-medium" : ""}>
                              {LABELS[i] ?? `${i + 1}.`} {c.text}
                            </li>
                          ))}
                        </ol>
                      )}
                    </article>
                  );
                })}
              </section>
            );
          })}
          {groups.list.length > limit && (
            <button onClick={() => setLimit((n) => n + PAGE)} className="w-full py-2 text-sm text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50">
              더 보기 ({groups.list.length - limit}개 지문 남음)
            </button>
          )}
        </div>
      </div>

      {/* ───── 오른쪽: 시험지 미리보기 ───── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 xl:sticky xl:top-4">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">시험지 미리보기</h3>
          <span className="text-sm text-gray-500">{items.length}문항</span>
          <span className="ml-auto text-sm font-medium text-blue-600">총 {total}점</span>
          {items.length > 0 && (
            <button
              onClick={() => { if (confirm("담은 문제를 모두 뺄까요?")) onItemsChange([]); }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              모두 빼기
            </button>
          )}
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto bg-gray-50 p-3">
          <div className="bg-white shadow-sm border border-gray-200 rounded px-5 py-4 min-h-[20rem]">
            <div className="text-center border-b-2 border-gray-800 pb-2 mb-3">
              <p className="font-bold text-gray-900">{header.title || "(시험지 제목)"}</p>
              {(header.school || header.grade) && (
                <p className="text-xs text-gray-500 mt-0.5">{[header.school, header.grade].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">왼쪽에서 문제 카드를 눌러 담으세요.</p>
            ) : (
              <ol>
                {items.map((it, index) => {
                  const x = it.question;
                  const choices = parseChoices(x.choices);
                  const r = runOf(index);
                  const isRunStart = runStarts[r] === index;
                  const inSet = runs[r]?.set;
                  const prevSamePassage = index > 0 && inSet && !isRunStart; // 세트는 지문을 한 번만
                  return (
                    <li
                      key={it.questionId}
                      draggable
                      onDragStart={(e) => { setDragFrom(index); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { e.preventDefault(); setDropAt(runStarts[runOf(index)]); }}
                      onDragLeave={() => setDropAt(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragFrom !== null) moveRun(runOf(dragFrom), runOf(index));
                        setDragFrom(null);
                        setDropAt(null);
                      }}
                      onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
                      className={`group relative py-3 border-b border-dashed border-gray-200 last:border-b-0 ${
                        dropAt === index && dragFrom !== null && runOf(dragFrom) !== r ? "border-t-2 border-t-blue-500" : ""
                      } ${dragFrom !== null && runOf(dragFrom) === r ? "opacity-40" : ""}`}
                    >
                      <div className="absolute right-0 top-2 flex items-center gap-1 opacity-60 group-hover:opacity-100">
                        <label className="flex items-center gap-0.5 text-[11px] text-gray-500" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min={0}
                            value={it.customPoints ?? x.points}
                            onChange={(e) => setPoints(it.questionId, e.target.value)}
                            className="w-10 border border-gray-200 rounded px-1 py-0.5 text-right"
                            aria-label={`${it.orderNum}번 배점`}
                          />
                          점
                        </label>
                        <button onClick={() => setEditingId(x.id)} className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                          고치기
                        </button>
                        <button onClick={() => remove(it.questionId)} className="text-[11px] px-1.5 py-0.5 rounded border border-red-100 text-red-500 hover:bg-red-50" aria-label={`${it.orderNum}번 빼기`}>
                          빼기
                        </button>
                      </div>
                      <div className="flex gap-2 pr-40">
                        <span className="cursor-grab select-none text-gray-300 group-hover:text-gray-500" title="끌어서 순서 바꾸기" aria-hidden>⠿</span>
                        <p className="text-sm text-gray-900">
                          <b>{it.orderNum}.</b> {x.question}
                          {inSet && isRunStart && <span className="ml-1 text-[11px] text-amber-700">[장문 세트]</span>}
                        </p>
                      </div>
                      {x.passage.trim() && !prevSamePassage && (
                        <div className="mt-2 ml-5 border border-gray-300 px-3 py-2 text-[13px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                          <PassageText text={x.passage} />
                        </div>
                      )}
                      {choices.length > 0 && (
                        <ol className="mt-2 ml-5 space-y-0.5 text-[13px] text-gray-800">
                          {choices.map((c, i) => (
                            <li key={i}>
                              {LABELS[i] ?? `${i + 1}.`} {c.text}
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      {editingId && (
        <QuestionQuickEdit
          id={editingId}
          onClose={() => setEditingId(null)}
          onSaved={async () => {
            // 고친 원본을 다시 읽어 왼쪽 카드와 오른쪽 시험지에 함께 반영
            const res = await fetch(`/api/questions/${editingId}`);
            if (!res.ok) return;
            const fresh = (await res.json()) as Partial<Q>;
            const old = questions.find((x) => x.id === editingId) ?? items.find((i) => i.questionId === editingId)?.question;
            if (!old) return;
            const merged = { ...old, ...fresh, passageRef: old.passageRef, stats: old.stats } as Q;
            onQuestionUpdated(merged);
            onItemsChange(items.map((i) => (i.questionId === merged.id ? { ...i, question: merged } : i)));
          }}
        />
      )}
    </div>
  );
}
