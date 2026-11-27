import { useEffect, useMemo, useRef, useState } from "react";
import { getVocabSet, getVocabSets, saveVocabResults, type VocabSetRow, type VocabWordRow } from "../lib/api";

type Mode = "cards" | "quiz";
type Result = { wordId: string; correct?: boolean; known?: boolean };

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// 단어 학습: 선생님이 배정한 단어 세트를 카드 넘기기·뜻 고르기로 외운다
export default function Vocab({ onDone }: { onDone: () => void }) {
  const [sets, setSets] = useState<VocabSetRow[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<{ id: string; title: string; words: VocabWordRow[] } | null>(null);
  const [study, setStudy] = useState<{ mode: Mode; words: VocabWordRow[] } | null>(null);
  const [onlyUnknown, setOnlyUnknown] = useState(true);

  async function loadSets() {
    try {
      setSets((await getVocabSets()).sets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요");
      setSets([]);
    }
  }
  useEffect(() => {
    loadSets();
  }, []);

  async function openSet(id: string) {
    try {
      setOpen(await getVocabSet(id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "불러오지 못했어요");
    }
  }

  if (open && study) {
    return (
      <Study
        setId={open.id}
        title={open.title}
        mode={study.mode}
        words={study.words}
        allWords={open.words}
        onExit={async () => {
          setStudy(null);
          await openSet(open.id);
          loadSets();
        }}
      />
    );
  }

  if (open) {
    const known = open.words.filter((w) => w.known).length;
    const pool = onlyUnknown ? open.words.filter((w) => !w.known) : open.words;
    return (
      <Shell title={open.title} onBack={() => setOpen(null)}>
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <p className="text-sm text-gray-600">
            외운 단어 <b className="text-[#245B3E]">{known}</b> / {open.words.length}
          </p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#245B3E]" style={{ width: `${open.words.length ? (known / open.words.length) * 100 : 0}%` }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={onlyUnknown} onChange={(e) => setOnlyUnknown(e.target.checked)} />
            아직 못 외운 단어만 ({open.words.length - known}개)
          </label>
        </div>
        {pool.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm shadow-sm text-[#245B3E]">
            다 외웠어요! 🎉 전체를 다시 보려면 위 체크를 끄세요.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStudy({ mode: "cards", words: shuffle(pool) })} className="bg-white rounded-2xl p-5 shadow-sm text-left">
              <span className="text-2xl">🃏</span>
              <span className="block font-medium text-gray-800 mt-1">카드로 외우기</span>
              <span className="text-xs text-gray-500">단어 보고 뜻 떠올리기</span>
            </button>
            <button
              onClick={() => setStudy({ mode: "quiz", words: shuffle(pool) })}
              disabled={open.words.length < 2}
              className="bg-white rounded-2xl p-5 shadow-sm text-left disabled:opacity-40"
            >
              <span className="text-2xl">✅</span>
              <span className="block font-medium text-gray-800 mt-1">뜻 고르기</span>
              <span className="text-xs text-gray-500">4개 중 맞는 뜻 고르기</span>
            </button>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
          {open.words.map((w) => (
            <div key={w.id} className="px-4 py-2 flex items-center gap-2 text-sm">
              <span className={`w-4 ${w.known ? "text-[#245B3E]" : "text-gray-200"}`}>●</span>
              <span className="font-medium text-gray-800">{w.word}</span>
              <span className="text-gray-500 truncate ml-auto text-right">{w.meaning}</span>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="단어 학습" onBack={onDone}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sets === null ? (
        <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">불러오는 중...</div>
      ) : sets.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">아직 배정된 단어 세트가 없어요.</div>
      ) : (
        sets.map((s) => (
          <button key={s.id} onClick={() => openSet(s.id)} className="w-full bg-white rounded-2xl p-4 shadow-sm text-left">
            <span className="block font-medium text-gray-800">{s.title}</span>
            <span className="text-xs text-gray-500">
              외운 단어 {s.known} / {s.total}
            </span>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#245B3E]" style={{ width: `${s.total ? (s.known / s.total) * 100 : 0}%` }} />
            </div>
          </button>
        ))
      )}
    </Shell>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f5] pb-10">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-white/80 text-lg leading-none" aria-label="뒤로">
          ‹
        </button>
        <span className="font-semibold truncate">{title}</span>
      </header>
      <main className="p-4 max-w-md mx-auto space-y-3">{children}</main>
    </div>
  );
}

// 학습 화면: 카드(알아요/몰라요) 또는 뜻 고르기. 몰라요·틀린 단어는 뒤에 한 번 더 나온다.
function Study({
  setId,
  title,
  mode,
  words,
  allWords,
  onExit,
}: {
  setId: string;
  title: string;
  mode: Mode;
  words: VocabWordRow[];
  allWords: VocabWordRow[];
  onExit: () => void;
}) {
  const [queue, setQueue] = useState<VocabWordRow[]>(words);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const pending = useRef<Result[]>([]);
  const retried = useRef<Set<string>>(new Set());
  const [saveError, setSaveError] = useState("");

  const cur = queue[pos];
  const done = pos >= queue.length;

  // 뜻 고르기 보기: 정답 + 같은 세트의 다른 뜻 3개
  const options = useMemo(() => {
    if (mode !== "quiz" || !cur) return [];
    const others = shuffle(allWords.filter((w) => w.id !== cur.id && w.meaning !== cur.meaning)).slice(0, 3);
    return shuffle([cur, ...others]);
  }, [mode, cur, allWords]);

  async function flush() {
    if (pending.current.length === 0) return;
    const batch = pending.current;
    pending.current = [];
    try {
      await saveVocabResults(setId, batch);
      setSaveError("");
    } catch {
      pending.current = [...batch, ...pending.current];
      setSaveError("기록 저장이 잠시 안 됐어요. 계속하면 다시 시도해요.");
    }
  }
  useEffect(() => {
    if (done) flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function record(r: Result) {
    pending.current.push(r);
    if (pending.current.length >= 10) flush();
  }

  function next(requeue: boolean) {
    if (requeue && cur && !retried.current.has(cur.id)) {
      retried.current.add(cur.id);
      setQueue((q) => [...q, cur]);
    }
    setFlipped(false);
    setPicked(null);
    setPos((p) => p + 1);
  }

  function cardAnswer(known: boolean) {
    if (!cur) return;
    record({ wordId: cur.id, known });
    setStats((s) => (known ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
    next(!known);
  }

  function quizPick(w: VocabWordRow) {
    if (!cur || picked) return;
    setPicked(w.id);
    const ok = w.id === cur.id;
    record({ wordId: cur.id, correct: ok });
    setStats((s) => (ok ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
    setTimeout(() => next(!ok), ok ? 600 : 1400);
  }

  async function exit() {
    await flush();
    onExit();
  }

  return (
    <Shell title={`${title} · ${mode === "cards" ? "카드" : "뜻 고르기"}`} onBack={exit}>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#245B3E]" style={{ width: `${queue.length ? (Math.min(pos, queue.length) / queue.length) * 100 : 0}%` }} />
        </div>
        <span>
          {Math.min(pos, queue.length)}/{queue.length}
        </span>
      </div>
      {saveError && <p className="text-xs text-amber-700">{saveError}</p>}

      {done ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
          <p className="text-3xl">🎉</p>
          <p className="font-semibold text-gray-800">끝까지 했어요!</p>
          <p className="text-sm text-gray-600">
            {mode === "cards" ? "알아요" : "맞힘"} {stats.right} · {mode === "cards" ? "몰라요" : "틀림"} {stats.wrong}
          </p>
          <button onClick={exit} className="w-full py-3 rounded-xl bg-[#245B3E] text-white font-medium">
            돌아가기
          </button>
        </div>
      ) : mode === "cards" ? (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="w-full min-h-[16rem] bg-white rounded-3xl shadow-sm flex flex-col items-center justify-center p-6 text-center"
            aria-label={flipped ? "단어 보기" : "뜻 보기"}
          >
            <span className="text-3xl font-bold text-gray-900 break-words">{cur.word}</span>
            {flipped ? (
              <>
                <span className="mt-4 text-xl text-[#245B3E]">{cur.meaning}</span>
                {cur.example && <span className="mt-3 text-sm text-gray-500 italic">{cur.example}</span>}
              </>
            ) : (
              <span className="mt-4 text-sm text-gray-400">눌러서 뜻 보기</span>
            )}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => cardAnswer(false)} className="py-4 rounded-2xl bg-white shadow-sm text-red-600 font-medium">
              몰라요
            </button>
            <button onClick={() => cardAnswer(true)} className="py-4 rounded-2xl bg-[#245B3E] text-white font-medium">
              알아요
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="w-full min-h-[9rem] bg-white rounded-3xl shadow-sm flex items-center justify-center p-6">
            <span className="text-3xl font-bold text-gray-900 break-words text-center">{cur.word}</span>
          </div>
          <div className="space-y-2">
            {options.map((o) => {
              const isAnswer = o.id === cur.id;
              const state = !picked ? "" : isAnswer ? "bg-emerald-50 border-emerald-500 text-emerald-800" : picked === o.id ? "bg-red-50 border-red-400 text-red-700" : "opacity-50";
              return (
                <button
                  key={o.id}
                  onClick={() => quizPick(o)}
                  disabled={!!picked}
                  className={`w-full text-left px-4 py-3 rounded-2xl bg-white border-2 border-transparent shadow-sm text-gray-800 ${state}`}
                >
                  {o.meaning}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
