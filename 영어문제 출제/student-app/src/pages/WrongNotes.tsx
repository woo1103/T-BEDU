import { useEffect, useState } from "react";
import { getWrongNotes, updateWrongNote, type WrongNote } from "../lib/api";

export default function WrongNotes({ onDone }: { onDone: () => void }) {
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(all: boolean) {
    setLoading(true);
    try {
      const d = await getWrongNotes(all);
      setNotes(d.notes);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(showAll);
  }, [showAll]);

  async function toggleResolve(n: WrongNote) {
    await updateWrongNote(n.id, { resolved: !n.resolved });
    load(showAll);
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5] pb-10">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onDone} className="text-white/80 text-lg leading-none">
          ‹
        </button>
        <span className="font-semibold">오답노트</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          완료한 항목도 보기
        </label>

        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            불러오는 중...
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            {showAll ? "오답노트가 없습니다." : "복습할 오답이 없습니다. 잘하고 있어요!"}
          </div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="bg-white rounded-2xl p-4 shadow-sm">
              {n.question ? (
                <>
                  <p className="text-sm font-medium text-gray-800">
                    {n.question.question}
                  </p>
                  {n.question.passage && (
                    <div className="bg-gray-50 rounded-lg p-3 my-2">
                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-gray-600">
                        {n.question.passage}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1 mt-2">
                    {n.question.choices.map((c) => {
                      const isCorrect = c.label === n.question!.correct;
                      const isMine = c.label === n.selected;
                      return (
                        <div
                          key={c.label}
                          className={`flex items-start gap-2 rounded-lg px-2 py-1 text-sm ${
                            isCorrect
                              ? "bg-green-50 text-green-800"
                              : isMine
                              ? "bg-red-50 text-red-700"
                              : "text-gray-600"
                          }`}
                        >
                          <span className="font-bold">{c.label}</span>
                          <span className="flex-1">{c.text}</span>
                          {isCorrect && <span className="text-xs">정답</span>}
                          {isMine && !isCorrect && (
                            <span className="text-xs">내 선택</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {n.question.explanation && (
                    <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">
                      해설: {n.question.explanation}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">문항 정보를 불러올 수 없습니다.</p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span
                  className={`text-xs ${
                    n.resolved ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {n.resolved ? "복습 완료" : "미복습"}
                </span>
                <button
                  onClick={() => toggleResolve(n)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                    n.resolved
                      ? "bg-gray-100 text-gray-600"
                      : "bg-[#245B3E] text-white"
                  }`}
                >
                  {n.resolved ? "되돌리기" : "복습 완료"}
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
