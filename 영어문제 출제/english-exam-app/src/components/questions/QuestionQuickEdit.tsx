"use client";

import { useEffect, useState } from "react";
import { normalizeMarkerChoices } from "@/lib/passage-parser";

const LABELS = ["①", "②", "③", "④", "⑤"];

interface FullQuestion {
  id: string;
  examType: string;
  questionType: string;
  number: number | null;
  points: number;
  passage: string;
  question: string;
  choices: string;
  answer: string;
  explanation: string | null;
  difficulty: string;
  tags: string | null;
  source: string | null;
  verifyStatus: string | null;
  verifyNote: string | null;
}

interface EditChoice {
  text: string;
  isCorrect: boolean;
}

// 문제은행 목록에서 바로 여는 수정 창: 지문·발문·선지·정답·해설 수정 + 저장 후 다시 검수
export default function QuestionQuickEdit({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState<FullQuestion | null>(null);
  const [passage, setPassage] = useState("");
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<EditChoice[]>([]);
  const [answerText, setAnswerText] = useState(""); // 서술형 모범답안
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "verify">("");
  const [status, setStatus] = useState<{ kind: string; note: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/questions/${id}`)
      .then((r) => r.json())
      .then((data: FullQuestion) => {
        setQ(data);
        setPassage(data.passage);
        setQuestion(data.question);
        let parsed: { label?: string; text?: string; isCorrect?: boolean }[] = [];
        try {
          parsed = JSON.parse(data.choices);
        } catch {
          parsed = [];
        }
        // 마커형 선지(③,①,②…로 저장된 경우)는 ①→⑤ 순으로 맞춰 편집 → 저장 시 라벨·정답이 어긋나지 않게
        const norm = normalizeMarkerChoices(
          parsed.map((c, i) => ({ label: c.label ?? LABELS[i] ?? "", text: c.text ?? "", isCorrect: !!c.isCorrect }))
        );
        setChoices(norm.map((c) => ({ text: c.text, isCorrect: c.isCorrect })));
        setAnswerText(data.answer);
        setExplanation(data.explanation ?? "");
        if (data.verifyStatus) setStatus({ kind: data.verifyStatus, note: data.verifyNote ?? "" });
      });
  }, [id]);

  const writing = q ? choices.length === 0 : false;

  async function save(thenVerify: boolean) {
    if (!q) return;
    setError("");
    if (!writing && choices.filter((c) => c.isCorrect).length !== 1) {
      setError("정답을 정확히 하나 골라 주세요.");
      return;
    }
    setBusy("save");
    try {
      const correct = choices.findIndex((c) => c.isCorrect);
      const body = {
        examType: q.examType,
        questionType: q.questionType,
        number: q.number,
        points: q.points,
        passage,
        question,
        choices: choices.map((c, i) => ({ label: LABELS[i] ?? `(${i + 1})`, text: c.text, isCorrect: c.isCorrect })),
        answer: writing ? answerText : LABELS[correct],
        explanation,
        difficulty: q.difficulty,
        tags: q.tags ? JSON.parse(q.tags) : null,
        source: q.source,
      };
      const res = await fetch(`/api/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`저장 실패(${res.status})`);
      onSaved();
      if (!thenVerify || writing) {
        onClose();
        return;
      }
      setBusy("verify");
      const vr = await fetch("/api/questions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await vr.json();
      if (!vr.ok) throw new Error(data.error || "검수 실패");
      const r = data.results?.[0];
      if (r) setStatus({ kind: r.status, note: r.note });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBusy("");
    }
  }

  const statusBox =
    status &&
    ({
      ok: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", title: "검수 통과" },
      suspect: { cls: "bg-amber-50 text-amber-900 border-amber-200", title: "검수 의심" },
      error: { cls: "bg-red-50 text-red-800 border-red-200", title: "검수 실패" },
    }[status.kind] ?? null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="문제 바로 고치기"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">문제 바로 고치기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="닫기">
            ✕
          </button>
        </div>

        {!q ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : (
          <>
            {statusBox && (
              <div className={`text-sm border rounded-lg px-3 py-2 ${statusBox.cls}`}>
                <b>{statusBox.title}</b>
                {status?.note && <span> — {status.note}</span>}
              </div>
            )}

            <label className="block">
              <span className="text-xs text-gray-500">발문</span>
              <input
                id="qe-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">지문</span>
              <textarea
                id="qe-passage"
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                rows={9}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
              />
            </label>

            {writing ? (
              <label className="block">
                <span className="text-xs text-gray-500">모범답안</span>
                <textarea
                  id="qe-answer"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
            ) : (
              <fieldset className="space-y-2">
                <legend className="text-xs text-gray-500">선지 (동그라미를 눌러 정답 선택)</legend>
                {choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="qe-correct"
                      id={`qe-correct-${i}`}
                      checked={c.isCorrect}
                      onChange={() => setChoices(choices.map((x, k) => ({ ...x, isCorrect: k === i })))}
                      aria-label={`${LABELS[i]} 정답으로`}
                    />
                    <span className="w-5 text-sm">{LABELS[i]}</span>
                    <input
                      id={`qe-choice-${i}`}
                      value={c.text}
                      onChange={(e) => setChoices(choices.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-sm ${
                        c.isCorrect ? "border-emerald-500 bg-emerald-50" : "border-gray-300"
                      }`}
                    />
                  </div>
                ))}
              </fieldset>
            )}

            <label className="block">
              <span className="text-xs text-gray-500">해설</span>
              <textarea
                id="qe-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                닫기
              </button>
              <button
                onClick={() => save(false)}
                disabled={busy !== ""}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === "save" ? "저장 중..." : "저장"}
              </button>
              {!writing && (
                <button
                  onClick={() => save(true)}
                  disabled={busy !== ""}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy === "verify" ? "다시 검수 중..." : busy === "save" ? "저장 중..." : "저장하고 다시 검수"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
