"use client";

import { useEffect, useState } from "react";
import MathText from "@/components/MathText";

export interface EditableMathProblem {
  id: string;
  source: string | null;
  grade: string | null;
  unit: string | null;
  difficulty: string | null;
  problemLatex: string;
  answer: string | null;
  solution: string | null;
  cropImageId: string | null;
}

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];
const DIFFS = ["하", "중", "상", "킬러"];

// 인식이 틀린 수식·글자 고치기: 왼쪽 원본, 오른쪽 편집 + 실시간 미리보기
export default function MathProblemEditor({
  problem,
  units,
  onClose,
  onSaved,
}: {
  problem: EditableMathProblem;
  units: string[]; // 이미 쓰는 단원 이름(같은 단원을 같은 글자로 적도록 제안)
  onClose: () => void;
  onSaved: () => void;
}) {
  const [latex, setLatex] = useState(problem.problemLatex);
  const [unit, setUnit] = useState(problem.unit ?? "");
  const [grade, setGrade] = useState(problem.grade ?? "");
  const [difficulty, setDifficulty] = useState(problem.difficulty ?? "");
  const [source, setSource] = useState(problem.source ?? "");
  const [answer, setAnswer] = useState(problem.answer ?? "");
  const [solution, setSolution] = useState(problem.solution ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!latex.trim()) return setError("문제 본문이 비어 있어요.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/math-problems/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // 빈 칸은 ""로 보내 지운다(서버가 빈 문자열을 null로 저장)
        body: JSON.stringify({ problemLatex: latex, unit, grade, difficulty, source, answer, solution }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="수학 문제 고치기"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">문제 고치기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <p className="text-xs text-gray-500">원본</p>
            {problem.cropImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/math-images/${problem.cropImageId}`} alt="원본 문제" className="max-w-full border border-gray-200 rounded" />
            ) : (
              <p className="text-sm text-gray-400">저장된 원본 이미지가 없어요(예전 방식으로 올린 문제).</p>
            )}
            <p className="text-xs text-gray-500 pt-2">미리보기</p>
            <div className="text-sm leading-relaxed border border-gray-100 rounded p-3 bg-gray-50">
              <MathText text={latex} />
            </div>
          </div>

          <div className="space-y-3 min-w-0">
            <label className="block">
              <span className="text-xs text-gray-500">문제 본문 — 수식은 $...$ 로 감싸요. 예: $x^2 - 4x + 3$, $\frac{1}{2}$, $\sqrt{3}$</span>
              <textarea
                id="mp-latex"
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                rows={10}
                className={`${input} mt-1 font-mono leading-relaxed`}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-gray-500">단원</span>
                <input id="mp-unit" list="mp-units" value={unit} onChange={(e) => setUnit(e.target.value)} className={`${input} mt-1`} />
                <datalist id="mp-units">
                  {units.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">출처</span>
                <input id="mp-source" value={source} onChange={(e) => setSource(e.target.value)} className={`${input} mt-1`} />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">학년</span>
                <select id="mp-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={`${input} mt-1`}>
                  <option value="">없음</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">난이도</span>
                <select id="mp-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${input} mt-1`}>
                  <option value="">없음</option>
                  {DIFFS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-gray-500">정답 (객관식은 선지 번호, 예: ③)</span>
              <input id="mp-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className={`${input} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">풀이</span>
              <textarea id="mp-solution" value={solution} onChange={(e) => setSolution(e.target.value)} rows={3} className={`${input} mt-1`} />
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
