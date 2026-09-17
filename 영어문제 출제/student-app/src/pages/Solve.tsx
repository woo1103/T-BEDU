import { useEffect, useState } from "react";
import {
  getAssessment,
  submitAnswers,
  type AssessmentItem,
  type WorksheetSolveItem,
  type GradeResult,
} from "../lib/api";

interface Props {
  assignmentId: string;
  title: string;
  onDone: () => void;
}

const CIRCLE = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export default function Solve({ assignmentId, title, onDone }: Props) {
  const [type, setType] = useState<"exam" | "worksheet">("exam");
  const [examItems, setExamItems] = useState<AssessmentItem[]>([]);
  const [wsItems, setWsItems] = useState<WorksheetSolveItem[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await getAssessment(assignmentId);
        setType(d.type);
        if (d.type === "worksheet") {
          setWsItems(d.items as WorksheetSolveItem[]);
          setFileUrl(d.fileUrl ?? null);
        } else {
          setExamItems(d.items as AssessmentItem[]);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId]);

  const total = type === "worksheet" ? wsItems.length : examItems.length;
  const answeredCount = Object.values(selected).filter((v) => v.trim() !== "").length;

  async function submit() {
    setSubmitting(true);
    setErr("");
    try {
      const answers =
        type === "worksheet"
          ? wsItems.map((it) => ({
              questionId: it.itemId,
              selected: selected[it.itemId] ?? "",
            }))
          : examItems.map((it) => ({
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
            {result.writingResults && result.writingResults.length > 0 && (
              <div className="mt-4 text-left space-y-2 border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700">서술형 채점 (AI)</p>
                {result.writingResults.map((w) => (
                  <div key={w.questionId} className="bg-[#f4f6f5] rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {w.orderNum}번
                      </span>
                      <span className="text-sm font-bold text-[#245B3E]">
                        {w.awarded}/{w.points}점
                      </span>
                    </div>
                    {w.feedback && (
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {w.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
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
        ) : result ? null : type === "worksheet" ? (
          <>
            {/* 문제지 파일 */}
            {fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <img
                  src={fileUrl}
                  alt="문제지"
                  className="w-full rounded-2xl border border-gray-200"
                />
              </a>
            ) : (
              <div className="bg-white rounded-2xl p-4 text-center text-gray-400 text-sm shadow-sm">
                문제지 파일이 없습니다. 배포된 문제지를 참고해 답을 입력하세요.
              </div>
            )}
            {/* 답 마킹 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-sm font-medium text-gray-800">답안 마킹</p>
              {wsItems.map((it) => (
                <div key={it.itemId} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#245B3E] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {it.number}
                  </span>
                  {it.choicesCount ? (
                    <div className="flex gap-1 flex-wrap">
                      {CIRCLE.slice(0, it.choicesCount).map((label) => {
                        const on = selected[it.itemId] === label;
                        return (
                          <button
                            key={label}
                            onClick={() =>
                              setSelected((p) => ({ ...p, [it.itemId]: label }))
                            }
                            className={`w-8 h-8 rounded-full text-sm font-bold ${
                              on
                                ? "bg-[#245B3E] text-white"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      value={selected[it.itemId] ?? ""}
                      onChange={(e) =>
                        setSelected((p) => ({ ...p, [it.itemId]: e.target.value }))
                      }
                      placeholder="정답 입력(주관식)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          examItems.map((it) => (
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
              {it.choices.length === 0 ? (
                <div>
                  <textarea
                    value={selected[it.questionId] ?? ""}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [it.questionId]: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="답안을 영어로 작성하세요 (서술형)"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm leading-relaxed focus:border-[#245B3E] focus:ring-1 focus:ring-[#245B3E]"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    서술형 문항입니다. 제출 시 AI가 자동 채점합니다.
                  </p>
                </div>
              ) : (
              <div className="space-y-2">
                {it.choices.map((c) => {
                  const on = selected[it.questionId] === c.label;
                  return (
                    <button
                      key={c.label}
                      onClick={() =>
                        setSelected((prev) => ({ ...prev, [it.questionId]: c.label }))
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
              )}
            </div>
          ))
        )}
      </main>

      {!result && !loading && total > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#f4f6f5] to-transparent">
          <div className="max-w-md mx-auto">
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-[#245B3E] text-white font-semibold disabled:opacity-50 shadow-lg"
            >
              {submitting
                ? "채점 중..."
                : `제출하고 채점 (${answeredCount}/${total})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
