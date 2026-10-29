"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseOmrLine, toOmrLine, type ItemStat } from "@/lib/omr";
import { isAnswerCorrect } from "@/lib/grading";

interface Item {
  refId: string;
  label: string;
  correct: string;
  maxPoints: number;
  writing: boolean;
  choice: boolean;
}

interface StudentRow {
  id: string;
  name: string;
  submission: {
    score: number;
    totalPoints: number;
    correctCount: number;
    selected: string[];
    points: number[];
    isCorrect: boolean[];
  } | null;
}

interface PaperData {
  assignment: { id: string; title: string; className: string; examId: string | null };
  items: Item[];
  students: StudentRow[];
  summary: { count: number; average: number; max: number; min: number; totalPoints: number };
  stats: ItemStat[];
}

// 학생 한 줄의 입력값
interface Draft {
  line: string; // 객관식 숫자 한 줄
  shorts: Record<number, string>; // 단답(문항 순서 → 답)
  writing: Record<number, string>; // 서술형 점수
  dirty: boolean;
}

function draftFrom(items: Item[], st: StudentRow): Draft {
  const sub = st.submission;
  const shorts: Record<number, string> = {};
  const writing: Record<number, string> = {};
  items.forEach((it, i) => {
    if (!sub) return;
    if (it.writing) writing[i] = String(sub.points[i] ?? "");
    else if (!it.choice) shorts[i] = sub.selected[i] ?? "";
  });
  const choiceSel = items.map((it, i) => (it.choice && sub ? sub.selected[i] : null)).filter((x): x is string => x !== null);
  return { line: sub ? toOmrLine(choiceSel) : "", shorts, writing, dirty: false };
}

// 과제 하나의 종이 답을 빠르게 입력하고 채점 결과·문항 통계를 본다
export default function PaperAnswersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<PaperData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/assignments/${id}/paper`);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "불러오지 못했어요.");
      return;
    }
    setData(d);
    // 고치고 있던 줄은 그대로 두고 나머지만 저장된 값으로
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const st of d.students as StudentRow[]) {
        next[st.id] = prev[st.id]?.dirty ? prev[st.id] : draftFrom(d.items, st);
      }
      return next;
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">불러오는 중...</p>;

  const items = data.items;
  const choiceIdx = items.map((it, i) => (it.choice ? i : -1)).filter((i) => i >= 0);
  const otherIdx = items.map((it, i) => (!it.choice ? i : -1)).filter((i) => i >= 0);
  const keyLine = toOmrLine(choiceIdx.map((i) => items[i].correct));

  function update(studentId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch, dirty: true } }));
  }

  // 입력값 → 문항 순서의 답 배열
  function selectedOf(d: Draft): string[] {
    const marks = parseOmrLine(d.line, choiceIdx.length);
    const out = items.map(() => "");
    choiceIdx.forEach((itemI, k) => (out[itemI] = marks[k]));
    otherIdx.forEach((i) => {
      if (!items[i].writing) out[i] = d.shorts[i] ?? "";
    });
    return out;
  }

  async function save(studentId: string, replace = false): Promise<boolean> {
    const d = drafts[studentId];
    setSaving(studentId);
    try {
      const res = await fetch(`/api/assignments/${id}/paper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          selected: selectedOf(d),
          writingPoints: items.map((it, i) => {
            if (!it.writing) return null;
            const v = (d.writing[i] ?? "").trim();
            return v === "" ? null : Number(v);
          }),
          replace,
        }),
      });
      const r = await res.json();
      if (res.status === 409 && r.exists) {
        if (!confirm(r.error)) return false;
        return save(studentId, true);
      }
      if (!res.ok) throw new Error(r.error || "저장 실패");
      setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], dirty: false } }));
      await load();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
      return false;
    } finally {
      setSaving(null);
    }
  }

  // Enter: 저장하고 다음 학생 칸으로
  async function saveAndNext(index: number) {
    const st = data!.students[index];
    if (await save(st.id)) inputs.current[data!.students[index + 1]?.id]?.focus();
  }

  const s = data.summary;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/assignments" className="text-xs text-gray-400 hover:text-gray-600">
            ← 과제 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">종이 답 입력 · 채점</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.assignment.title} · {data.assignment.className}
          </p>
        </div>
        {data.assignment.examId && (
          <Link
            href={`/exams/${data.assignment.examId}/omr`}
            target="_blank"
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            🖨️ OMR 답안지 인쇄
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat title="채점한 학생" value={`${s.count} / ${data.students.length}명`} />
        <Stat title="평균" value={`${s.average}점`} sub={`만점 ${s.totalPoints}점`} />
        <Stat title="최고" value={s.count ? `${s.max}점` : "-"} />
        <Stat title="최저" value={s.count ? `${s.min}점` : "-"} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            객관식 {choiceIdx.length}문항은 <b>고른 번호를 숫자로 이어서</b> 적어요. 띄어쓰기는 무시하고, 안 고른 문항은 <b>0</b>으로 적어요. 다 적고 <b>Enter</b>를 누르면 저장하고 다음 학생으로 넘어가요.
          </p>
          {choiceIdx.length > 0 && (
            <p className="text-xs text-gray-400 font-mono">정답: {keyLine}</p>
          )}
        </div>

        {data.students.length === 0 ? (
          <p className="text-sm text-gray-400">이 반에 학생이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">학생</th>
                  {choiceIdx.length > 0 && <th className="py-2 pr-3 font-medium">객관식 답</th>}
                  {otherIdx.map((i) => (
                    <th key={i} className="py-2 pr-2 font-medium whitespace-nowrap">
                      {items[i].label}
                      <span className="block text-xs font-normal text-gray-400">
                        {items[i].writing ? `점수(0~${items[i].maxPoints})` : "단답"}
                      </span>
                    </th>
                  ))}
                  <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">점수</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data.students.map((st, idx) => {
                  const d = drafts[st.id] ?? draftFrom(items, st);
                  const marks = parseOmrLine(d.line, choiceIdx.length);
                  return (
                    <tr key={st.id} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap font-medium text-gray-800">{st.name}</td>
                      {choiceIdx.length > 0 && (
                        <td className="py-2 pr-3 min-w-[16rem]">
                          <input
                            ref={(el) => {
                              inputs.current[st.id] = el;
                            }}
                            value={d.line}
                            inputMode="numeric"
                            onChange={(e) => update(st.id, { line: e.target.value.replace(/[^0-9\s.-]/g, "") })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                saveAndNext(idx);
                              }
                            }}
                            placeholder="예: 35241 14321"
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 font-mono tracking-wider"
                            aria-label={`${st.name} 객관식 답`}
                          />
                          {/* 입력한 답 미리보기: 맞으면 초록, 틀리면 빨강 */}
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {choiceIdx.map((itemI, k) => {
                              const m = marks[k];
                              const ok = m !== "" && isAnswerCorrect(m, items[itemI].correct);
                              return (
                                <span
                                  key={itemI}
                                  title={`${items[itemI].label} 정답 ${items[itemI].correct}`}
                                  className={`w-5 text-center text-xs rounded ${
                                    m === "" ? "bg-gray-100 text-gray-300" : ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                                  }`}
                                >
                                  {m || "·"}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      )}
                      {otherIdx.map((i) => (
                        <td key={i} className="py-2 pr-2">
                          {items[i].writing ? (
                            <input
                              type="number"
                              min={0}
                              max={items[i].maxPoints}
                              value={d.writing[i] ?? ""}
                              onChange={(e) => update(st.id, { writing: { ...d.writing, [i]: e.target.value } })}
                              className="w-16 border border-gray-300 rounded-lg px-2 py-1.5"
                              aria-label={`${st.name} ${items[i].label} 점수`}
                            />
                          ) : (
                            <input
                              value={d.shorts[i] ?? ""}
                              onChange={(e) => update(st.id, { shorts: { ...d.shorts, [i]: e.target.value } })}
                              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5"
                              aria-label={`${st.name} ${items[i].label} 답`}
                            />
                          )}
                        </td>
                      ))}
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {st.submission ? (
                          <span className="font-semibold text-gray-900">
                            {st.submission.score}
                            <span className="text-xs text-gray-400">/{st.submission.totalPoints}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">미입력</span>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <button
                          onClick={() => save(st.id)}
                          disabled={saving === st.id || !d.dirty}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs disabled:opacity-40"
                        >
                          {saving === st.id ? "저장 중..." : d.dirty ? "저장" : st.submission ? "저장됨" : "입력 전"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {s.count > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-1">문항별 정답률</h2>
          <p className="text-xs text-gray-400 mb-3">학생 앱 제출과 종이 답을 함께 셉니다. 50% 미만은 빨간색이에요.</p>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {data.stats.map((st) => (
              <div key={st.label} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-gray-500">{st.label}</span>
                <span className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                  <span
                    className={`block h-full ${st.rate < 50 ? "bg-red-400" : "bg-emerald-600"}`}
                    style={{ width: `${st.rate}%` }}
                  />
                </span>
                <span className={`w-12 text-right ${st.rate < 50 ? "text-red-600 font-medium" : "text-gray-700"}`}>{st.rate}%</span>
                <span className="w-24 text-xs text-gray-400">{st.topWrong ? `많이 고른 오답 ${st.topWrong}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
