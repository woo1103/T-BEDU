"use client";

import { useEffect, useState } from "react";

interface Assignment {
  id: string;
  title: string;
  dueAt: string | null;
  active: boolean;
  assignedAt: string;
  classId: string;
  assessment: { subject: string; type: string };
  class: { id: string; name: string };
  _count: { submissions: number };
}

const SUBJECT_LABEL: Record<string, string> = { english: "영어", math: "수학" };

function dueState(dueAt: string | null): { label: string; cls: string } {
  if (!dueAt) return { label: "마감 없음", cls: "text-gray-400" };
  const d = new Date(dueAt);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "마감됨", cls: "text-red-500" };
  if (days === 0) return { label: "오늘 마감", cls: "text-red-500" };
  if (days <= 3) return { label: `D-${days}`, cls: "text-amber-600" };
  return { label: `D-${days}`, cls: "text-gray-500" };
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/assignments");
    setAssignments((await res.json()).assignments || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
    else alert((await res.json()).error || "실패");
  }

  async function remove(id: string) {
    if (!confirm("이 과제를 삭제할까요? (학생 제출 기록도 삭제됩니다)")) return;
    const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">과제 · 마감 관리</h2>
        <p className="text-sm text-gray-500 mt-1">
          반에 배정된 시험지/문제지의 마감일을 설정하고 관리합니다.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 font-semibold text-gray-800">
          배정된 과제 {loading ? "" : `(${assignments.length})`}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            배정된 과제가 없습니다. (문제 은행/문제지에서 반에 배정하세요)
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {assignments.map((a) => {
              const ds = dueState(a.dueAt);
              return (
                <li key={a.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {SUBJECT_LABEL[a.assessment.subject] || a.assessment.subject}
                      </span>
                      {!a.active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                          비활성
                        </span>
                      )}
                      <span className="font-medium text-gray-800 truncate">
                        {a.title}
                      </span>
                      <span className="text-xs text-gray-400">· {a.class.name}</span>
                    </div>
                    <span className={`text-xs font-medium ${ds.cls}`}>{ds.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                      마감일
                      <input
                        type="date"
                        value={a.dueAt ? a.dueAt.slice(0, 10) : ""}
                        onChange={(e) => patch(a.id, { dueAt: e.target.value || null })}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                    </label>
                    <span className="text-xs text-gray-400">
                      제출 {a._count.submissions}건
                    </span>
                    <button
                      onClick={() => patch(a.id, { active: !a.active })}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {a.active ? "비활성화" : "활성화"}
                    </button>
                    <button
                      onClick={() => remove(a.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
