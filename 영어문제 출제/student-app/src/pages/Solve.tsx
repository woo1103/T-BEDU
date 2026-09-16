import { useEffect, useState } from "react";
import {
  getAssessment,
  submitAnswers,
  type AssessmentItem,
  type GradeResult,
} from "../lib/api";

interface Props {
  assignmentId: string;
  title: string;
  onDone: () => void;
}

export default function Solve({ assignmentId, title, onDone }: Props) {
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await getAssessment(assignmentId);
        setItems(d.items);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId]);

  const answeredCount = Object.keys(selected).length;

  async function submit() {
    setSubmitting(true);
    setErr("");
    try {
      const answers = items.map((it) => ({
        questionId: it.questionId,
        selected: selected[it.questionId] ?? "",
      }));
      const r = await submitAnswers(assignmentId, answers);
      setResult(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "제출 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5] pb-28">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onDone} className="text-white/80 text-lg leading-none">
          ‹
        </button>
        <span className="font-semibold truncate">{title}</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {result && (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-sm text-gray-500">채점 결과</p>
            <p className="text-4xl font-bold text-[#245B3E] mt-1">{result.rate}%</p>
            <p className="text-sm text-gray-600 mt-1">
              {result.correctCount}/{result.itemCount}문항 정답 · {result.score}/
              {result.totalPoints}점
            </p>
            <button
              onClick={onDone}
              className="mt-4 w-full py-3 rounded-xl bg-[#245B3E] text-white font-medium text-sm"
            >
              목록으로 (성취도 반영됨)
            </button>
          </div>
        )}

        {err && <p className="text-sm text-red-500">{err}</p>}

        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            불러오는 중...
          </div>
        ) : (
          !result &&
          items.map((it) => (
            <div key={it.questionId} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#245B3E] text-white text-xs font-bold flex items-center justify-center">
                  {it.orderNum}
                </span>
                <p className="text-sm font-medium text-gray-800">{it.question}</p>
              </div>
              {it.passage && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                    {it.passage}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {it.choices.map((c) => {
                  const on = selected[it.questionId] === c.label;
                  return (
                    <button
                      key={c.label}
                      onClick={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [it.questionId]: c.label,
                        }))
                      }
                      className={`w-full text-left flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        on
                          ? "border-[#245B3E] bg-[#245B3E]/5 text-gray-900"
                          : "border-gray-200 text-gray-700"
                      }`}
                    >
                      <span
                        className={`shrink-0 font-bold ${
                          on ? "text-[#245B3E]" : "text-gray-400"
                        }`}
                      >
                        {c.label}
                      </span>
                      <span>{c.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      {!result && !loading && items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#f4f6f5] to-transparent">
          <div className="max-w-md mx-auto">
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-[#245B3E] text-white font-semibold disabled:opacity-50 shadow-lg"
            >
              {submitting
                ? "채점 중..."
                : `제출하고 채점 (${answeredCount}/${items.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
