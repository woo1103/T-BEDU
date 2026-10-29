"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface JobRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  pending: number;
}

interface JobDetail extends JobRow {
  items: {
    id: string;
    typeName: string;
    status: string;
    error: string | null;
    questionId: string | null;
    question: string | null;
    verified: boolean;
  }[];
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  running: { label: "만드는 중", cls: "bg-blue-50 text-blue-700" },
  done: { label: "끝남", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "멈춤", cls: "bg-gray-100 text-gray-500" },
};

const ITEM_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "기다리는 중", cls: "text-gray-400" },
  running: { label: "만드는 중...", cls: "text-blue-600" },
  done: { label: "완료", cls: "text-emerald-700" },
  failed: { label: "실패", cls: "text-red-600" },
  cancelled: { label: "멈춤", cls: "text-gray-400" },
};

// 서버 백그라운드 생성 작업 — 창을 닫아도 서버가 이어서 만들고, 여기서 진행 상황을 본다
export default function GenJobsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id: selectedId } = use(searchParams);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await fetch("/api/gen-jobs").then((r) => r.json());
    setJobs(list.jobs ?? []);
    if (selectedId) {
      const res = await fetch(`/api/gen-jobs/${selectedId}`);
      setDetail(res.ok ? await res.json() : null);
    }
  }, [selectedId]);

  const anyRunning = (jobs ?? []).some((j) => j.status === "running");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버에서 불러온 뒤 상태를 채운다
    load();
  }, [load]);

  // 만드는 중인 작업이 있으면 4초마다 새로 고침
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load, anyRunning]);

  async function act(action: "retry" | "cancel") {
    if (!detail) return;
    if (action === "cancel" && !confirm("남은 문항 만들기를 멈출까요? (이미 만든 문항은 문제 은행에 남아요)")) return;
    setBusy(true);
    const res = await fetch(`/api/gen-jobs/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) alert((await res.json()).error || "실패");
    await load();
    setBusy(false);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">생성 작업</h1>
        <p className="text-sm text-gray-500 mt-1">
          “서버에 맡기기”로 시작한 문제 만들기예요. 창을 닫아도 서버가 한 문항씩 이어서 만들고, 다 만든 문제는 <b>문제 은행</b>에 바로 저장돼요.
        </p>
      </div>

      <div className="grid md:grid-cols-[18rem_1fr] gap-4 items-start">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {jobs === null ? (
            <p className="p-4 text-sm text-gray-400">불러오는 중...</p>
          ) : jobs.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">
              아직 맡긴 작업이 없어요. <Link href="/questions/new" className="text-purple-600 underline">문제 만들기</Link>에서 “서버에 맡기기”를 눌러 보세요.
            </p>
          ) : (
            jobs.map((j) => {
              const st = STATUS_LABEL[j.status] ?? STATUS_LABEL.running;
              return (
                <Link
                  key={j.id}
                  href={`/gen-jobs?id=${j.id}`}
                  className={`block p-3 hover:bg-gray-50 ${j.id === selectedId ? "bg-purple-50" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                    <span className="text-xs text-gray-400">{new Date(j.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 truncate">{j.title}</p>
                  <Progress done={j.done} failed={j.failed} total={j.total} />
                </Link>
              );
            })
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 min-h-[12rem]">
          {!detail ? (
            <p className="text-sm text-gray-400">왼쪽에서 작업을 고르세요.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-semibold text-gray-900">{detail.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {detail.done} / {detail.total}문항 완료
                    {detail.failed > 0 && <span className="text-red-600"> · 실패 {detail.failed}</span>}
                    {detail.status === "running" && " · 이 창을 닫아도 계속 만들어요"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(detail.failed > 0 || detail.status === "cancelled") && (
                    <button
                      onClick={() => act("retry")}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-50"
                    >
                      {detail.status === "cancelled" ? "이어서 만들기" : "실패한 것만 다시"}
                    </button>
                  )}
                  {detail.status === "running" && (
                    <button
                      onClick={() => act("cancel")}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm disabled:opacity-50"
                    >
                      멈추기
                    </button>
                  )}
                  {detail.done > 0 && (
                    <Link href="/questions" className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm">
                      문제 은행 보기
                    </Link>
                  )}
                </div>
              </div>
              <Progress done={detail.done} failed={detail.failed} total={detail.total} />

              <ol className="divide-y divide-gray-50">
                {detail.items.map((it, i) => {
                  const st = ITEM_LABEL[it.status] ?? ITEM_LABEL.pending;
                  return (
                    <li key={it.id} className="py-2 flex items-start gap-3 text-sm">
                      <span className="w-6 text-gray-400 text-right">{i + 1}</span>
                      <span className="w-28 shrink-0 text-gray-600">{it.typeName}</span>
                      <span className="flex-1 min-w-0">
                        {it.question ? (
                          <span className="text-gray-800 line-clamp-1">{it.question}</span>
                        ) : it.error ? (
                          <span className="text-xs text-red-500">{it.error}</span>
                        ) : null}
                      </span>
                      <span className={`shrink-0 text-xs ${st.cls}`}>
                        {st.label}
                        {it.status === "done" && it.verified && " · 검수 통과"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Progress({ done, failed, total }: { done: number; failed: number; total: number }) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div className="mt-2 flex h-2 rounded bg-gray-100 overflow-hidden">
      <span className="h-full bg-emerald-600" style={{ width: `${pct(done)}%` }} />
      <span className="h-full bg-red-400" style={{ width: `${pct(failed)}%` }} />
    </div>
  );
}
