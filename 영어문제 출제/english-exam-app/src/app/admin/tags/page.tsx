"use client";

import { useEffect, useState } from "react";

interface Tag {
  id: string;
  subject: string;
  kind: string;
  name: string;
  _count: { questionTags: number };
}

const SUBJECT_LABEL: Record<string, string> = { english: "영어", math: "수학" };

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [msg, setMsg] = useState("");

  // 생성 폼
  const [subject, setSubject] = useState("english");
  const [kind, setKind] = useState("영역");
  const [name, setName] = useState("");

  async function load() {
    const res = await fetch("/api/tags");
    const d = await res.json();
    setTags(d.tags || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function createTag() {
    if (!name.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, kind, name }),
    });
    if (!res.ok) {
      const e = await res.json();
      alert(e.error || "생성 실패");
      return;
    }
    setName("");
    await load();
  }

  async function renameTag(t: Tag) {
    const newName = prompt("태그 이름 수정", t.name);
    if (!newName || newName.trim() === t.name) return;
    const res = await fetch(`/api/tags/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) await load();
    else alert((await res.json()).error || "수정 실패");
  }

  async function deleteTag(t: Tag) {
    if (
      !confirm(
        `'${t.name}' 태그를 삭제할까요?${
          t._count.questionTags > 0
            ? ` (연결된 문항 ${t._count.questionTags}건의 태그도 해제됩니다)`
            : ""
        }`
      )
    )
      return;
    const res = await fetch(`/api/tags/${t.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function autoAssign() {
    if (!confirm("영어 문항에 유형 기준 능력영역 태그를 자동 배정할까요?")) return;
    setAssigning(true);
    setMsg("");
    const res = await fetch("/api/tags/auto-assign", { method: "POST" });
    const d = await res.json();
    setAssigning(false);
    if (res.ok) {
      setMsg(
        `자동 배정 완료: ${d.assigned}건 배정 / ${d.skipped}건 건너뜀 (전체 ${d.total}문항)`
      );
      await load();
    } else {
      setMsg(d.error || "실패");
    }
  }

  // subject → kind → tags 그룹화
  const grouped = new Map<string, Map<string, Tag[]>>();
  for (const t of tags) {
    if (!grouped.has(t.subject)) grouped.set(t.subject, new Map());
    const km = grouped.get(t.subject)!;
    if (!km.has(t.kind)) km.set(t.kind, []);
    km.get(t.kind)!.push(t);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">문항 태그</h2>
          <p className="text-sm text-gray-500 mt-1">
            능력영역·단원·개념 태그를 관리합니다. 취약점 분석의 근거가 됩니다.
          </p>
        </div>
        <button
          onClick={autoAssign}
          disabled={assigning}
          className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {assigning ? "배정 중..." : "영어 문항 자동 태깅"}
        </button>
      </div>

      {msg && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 text-sm rounded-lg px-4 py-2">
          {msg}
        </div>
      )}

      {/* 생성 폼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">태그 추가</h3>
        <div className="flex gap-2 flex-wrap">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="english">영어</option>
            <option value="math">수학</option>
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="영역">영역</option>
            <option value="단원">단원</option>
            <option value="개념">개념</option>
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTag()}
            placeholder="태그 이름"
            className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={createTag}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            추가
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">불러오는 중...</div>
      ) : (
        Array.from(grouped.entries()).map(([subj, kinds]) => (
          <div
            key={subj}
            className="bg-white rounded-xl shadow-sm border border-gray-100"
          >
            <div className="p-4 border-b border-gray-100 font-semibold text-gray-800">
              {SUBJECT_LABEL[subj] || subj}
            </div>
            <div className="p-4 space-y-4">
              {Array.from(kinds.entries()).map(([k, list]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400 font-medium mb-2">{k}</p>
                  <div className="flex flex-wrap gap-2">
                    {list.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-2 bg-gray-100 rounded-lg pl-3 pr-2 py-1.5 text-sm"
                      >
                        <span className="text-gray-800">{t.name}</span>
                        <span className="text-xs text-gray-400">
                          {t._count.questionTags}
                        </span>
                        <button
                          onClick={() => renameTag(t)}
                          className="text-gray-400 hover:text-blue-600 text-xs"
                          title="이름 수정"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => deleteTag(t)}
                          className="text-gray-400 hover:text-red-600 text-xs"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
