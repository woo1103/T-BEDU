import { useState } from "react";
import { answerPractice, getPractice, type PracticeQuestion } from "../lib/api";
import PassageView from "./PassageView";

type State =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "none"; reason: string }
  | { step: "solve"; q: PracticeQuestion; picked: string | null; checking: boolean }
  | { step: "result"; q: PracticeQuestion; picked: string; correct: boolean; correctLabel: string; explanation: string | null };

// 오답노트 카드 안: 비슷한 문제를 받아 바로 풀고 채점. 맞히면 그 오답은 복습 완료.
export default function PracticePanel({ wrongNoteId, onResolved }: { wrongNoteId: string; onResolved: () => void }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setState({ step: "loading" });
    try {
      const r = await getPractice(wrongNoteId);
      if ("none" in r) setState({ step: "none", reason: r.reason });
      else setState({ step: "solve", q: r, picked: null, checking: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
      setState({ step: "idle" });
    }
  }

  async function submit() {
    if (state.step !== "solve" || !state.picked) return;
    setState({ ...state, checking: true });
    try {
      const r = await answerPractice(state.q.attemptId, state.picked);
      setState({ step: "result", q: state.q, picked: state.picked, ...r });
    } catch (e) {
      setError(e instanceof Error ? e.message : "채점하지 못했어요.");
      setState({ ...state, checking: false });
    }
  }

  if (state.step === "idle") {
    return (
      <div className="mt-3">
        <button onClick={load} className="w-full text-sm py-2 rounded-xl border border-[#245B3E] text-[#245B3E] font-medium">
          🔁 비슷한 문제 풀기
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }
  if (state.step === "loading") {
    return (
      <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        비슷한 문제를 찾고 있어요… 은행에 없으면 새로 만들어서 30초~1분쯤 걸려요.
      </p>
    );
  }
  if (state.step === "none") {
    return <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{state.reason}</p>;
  }

  const q = state.q;
  const result = state.step === "result" ? state : null;
  return (
    <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
      <p className="text-xs text-[#245B3E] font-medium mb-1">비슷한 문제</p>
      <p className="text-sm font-medium text-gray-800 mb-2">{q.question}</p>
      {q.passage && <PassageView passage={q.passage} questionType={q.questionType} />}
      <div className="space-y-1">
        {q.choices.map((c) => {
          const picked = state.step === "solve" ? state.picked === c.label : result?.picked === c.label;
          const isAnswer = result && c.label === result.correctLabel;
          return (
            <button
              key={c.label}
              disabled={state.step !== "solve"}
              onClick={() => state.step === "solve" && setState({ ...state, picked: c.label })}
              className={`w-full flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-left border ${
                isAnswer
                  ? "bg-green-50 border-green-200 text-green-800"
                  : picked && result
                  ? "bg-red-50 border-red-200 text-red-700"
                  : picked
                  ? "bg-[#245B3E]/10 border-[#245B3E] text-gray-900"
                  : "border-transparent text-gray-700"
              }`}
            >
              <span className="font-bold">{c.label}</span>
              <span className="flex-1">{c.text !== c.label ? c.text : ""}</span>
            </button>
          );
        })}
      </div>
      {state.step === "solve" && (
        <button
          onClick={submit}
          disabled={!state.picked || state.checking}
          className="mt-3 w-full text-sm py-2 rounded-xl bg-[#245B3E] text-white font-medium disabled:opacity-40"
        >
          {state.checking ? "채점 중..." : "채점하기"}
        </button>
      )}
      {result && (
        <div className="mt-3 space-y-2">
          <p className={`text-sm font-semibold ${result.correct ? "text-green-700" : "text-red-600"}`}>
            {result.correct ? "맞았어요! 이 오답은 복습 완료로 바꿨어요." : `아쉬워요. 정답은 ${result.correctLabel}이에요.`}
          </p>
          {result.explanation && <p className="text-xs text-gray-500 whitespace-pre-wrap">해설: {result.explanation}</p>}
          {result.correct ? (
            <button onClick={onResolved} className="w-full text-sm py-2 rounded-xl bg-gray-100 text-gray-700">
              확인
            </button>
          ) : (
            <button onClick={load} className="w-full text-sm py-2 rounded-xl border border-[#245B3E] text-[#245B3E]">
              다른 비슷한 문제 풀기
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
