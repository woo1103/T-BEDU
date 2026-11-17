"use client";

import { useEffect, useState } from "react";

interface ClassRow {
  id: string;
  name: string;
  center: { name: string };
}
interface StudentMini {
  id: string;
  name: string;
  username: string;
}
interface AssignmentStatus {
  id: string;
  title: string;
  dueAt: string | null;
  submittedCount: number;
  total: number;
  missing: StudentMini[];
}
interface VideoStatus {
  videoId: string;
  title: string;
  watchedCount: number;
  total: number;
  notWatched: StudentMini[];
}
interface ItemStat {
  refId: string;
  subject: string;
  label: string;
  total: number;
  correct: number;
  rate: number;
}

export default function StatusPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [assignments, setAssignments] = useState<AssignmentStatus[]>([]);
  const [videos, setVideos] = useState<VideoStatus[]>([]);
  const [items, setItems] = useState<ItemStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // 삭제 뒤 다시 불러오기

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        setClasses(d.classes || []);
        if (d.classes?.[0]) setClassId(d.classes[0].id);
      });
  }, []);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/teacher/status?classId=${classId}`).then((r) => r.json()),
      fetch(`/api/teacher/item-stats?classId=${classId}&limit=15`).then((r) => r.json()),
    ]).then(([st, it]) => {
      setAssignments(st.assignments || []);
      setVideos(st.videos || []);
      setItems(it.items || []);
      setLoading(false);
    });
  }, [classId, reloadKey]);

  // 과제 하나 삭제(제출 기록 포함) / 이 반 과제 전체 삭제
  async function removeOne(a: AssignmentStatus) {
    const warn = a.submittedCount > 0 ? `\n제출한 학생 ${a.submittedCount}명의 점수·오답노트 기록도 함께 지워져요.` : "";
    if (!confirm(`'${a.title}' 과제를 이 반에서 삭제할까요?${warn}\n(되돌릴 수 없음)`)) return;
    const res = await fetch(`/api/assignments/${a.id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "삭제 실패");
    setReloadKey((k) => k + 1);
  }
  async function removeAll() {
    if (assignments.length === 0) return;
    const withSubs = assignments.filter((a) => a.submittedCount > 0).length;
    const className = classes.find((c) => c.id === classId)?.name ?? "이 반";
    if (!confirm(`'${className}'에 낸 과제 ${assignments.length}개를 모두 삭제할까요? (되돌릴 수 없음)`)) return;
    // 제출이 있는 과제는 한 번 더 묻는다. 아니오면 제출 없는 과제만 지운다
    const includeSubs =
      withSubs > 0 &&
      confirm(
        `그중 ${withSubs}개는 이미 제출한 학생이 있어요.\n[확인] 제출 기록(점수·오답노트)까지 모두 삭제   [취소] 제출 없는 과제만 삭제`
      );
    const res = await fetch(`/api/classes/${classId}/assignments${includeSubs ? "?withSubmissions=1" : ""}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || "삭제 실패");
    alert(`과제 ${d.removed}개를 삭제했어요.${d.kept ? ` 제출이 있는 ${d.kept}개는 남겨 두었어요.` : ""}`);
    setReloadKey((k) => k + 1);
  }

  async function remind(studentIds: string[], title: string, body: string) {
    if (studentIds.length === 0) return;
    if (!confirm(`${studentIds.length}명에게 독려 알림을 보낼까요?`)) return;
    const res = await fetch("/api/teacher/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds, title, body }),
    });
    if (res.ok) {
      const r = await res.json();
      alert(`${r.sent}명에게 알림을 보냈습니다.`);
    } else alert("발송 실패");
  }

  function rateColor(rate: number) {
    if (rate < 50) return "bg-red-400";
    if (rate < 70) return "bg-yellow-400";
    return "bg-green-500";
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">현황판</h2>
          <p className="text-sm text-gray-500 mt-1">
            반별 과제 미제출자·영상 미시청자와 많이 틀린 문항을 한눈에 보고 독려 알림을 보냅니다.
          </p>
        </div>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.center.name} · {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">불러오는 중...</div>
      ) : (
        <>
          {/* 과제 미제출 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">과제 미제출 현황</h3>
              {assignments.length > 0 && (
                <button onClick={removeAll} className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1">
                  이 반 과제 전체 삭제
                </button>
              )}
            </div>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400">배정된 과제가 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {assignments.map((a) => (
                  <li key={a.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{a.title}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-3">
                        제출 {a.submittedCount}/{a.total}
                        <button onClick={() => removeOne(a)} className="text-red-400 hover:text-red-600" title="이 과제 삭제">
                          삭제
                        </button>
                      </span>
                    </div>
                    {a.missing.length > 0 ? (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-red-500">
                          미제출: {a.missing.map((m) => m.name).join(", ")}
                        </span>
                        <button
                          onClick={() =>
                            remind(
                              a.missing.map((m) => m.id),
                              "과제 미제출 안내",
                              `'${a.title}' 과제를 아직 제출하지 않았어요. 확인해 주세요.`
                            )
                          }
                          className="ml-auto text-xs px-2.5 py-1 bg-[#245B3E] text-white rounded"
                        >
                          독려 알림
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-green-600">전원 제출 완료 ✅</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 영상 미시청 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">영상 미시청 현황</h3>
            {videos.length === 0 ? (
              <p className="text-sm text-gray-400">노출된 영상이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {videos.map((v) => (
                  <li key={v.videoId} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{v.title}</span>
                      <span className="text-xs text-gray-500">
                        시청 {v.watchedCount}/{v.total}
                      </span>
                    </div>
                    {v.notWatched.length > 0 ? (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-red-500">
                          미시청: {v.notWatched.map((m) => m.name).join(", ")}
                        </span>
                        <button
                          onClick={() =>
                            remind(
                              v.notWatched.map((m) => m.id),
                              "영상 미시청 안내",
                              `'${v.title}' 강의를 아직 보지 않았어요. 시청해 주세요.`
                            )
                          }
                          className="ml-auto text-xs px-2.5 py-1 bg-[#245B3E] text-white rounded"
                        >
                          독려 알림
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-green-600">전원 시청 ✅</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 정답률 낮은 문항 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-3">
              정답률 낮은 문항 (많이 틀린 순)
            </h3>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">채점된 제출이 아직 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.refId} className="flex items-center gap-3">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      {it.subject === "math" ? "수학" : "영어"}
                    </span>
                    <span className="text-sm text-gray-700 truncate flex-1">{it.label}</span>
                    <div className="w-24 bg-gray-100 rounded-full h-2 shrink-0">
                      <div
                        className={`h-2 rounded-full ${rateColor(it.rate)}`}
                        style={{ width: `${it.rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right shrink-0">
                      {it.rate}% ({it.correct}/{it.total})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
