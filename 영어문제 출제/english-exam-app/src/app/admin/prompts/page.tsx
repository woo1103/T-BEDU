"use client";

import { useState, useEffect } from "react";
import { EXAM_TYPE_MAP, getQuestionTypes } from "@/lib/question-types";

type Scope = "global" | "examType" | "questionType";

interface Directive {
  id: string;
  title: string;
  body: string;
  scope: Scope;
  scopeKey: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const SCOPE_LABELS: Record<Scope, string> = {
  global: "전역 (모든 출제)",
  examType: "시험 유형별",
  questionType: "문제 유형별",
};

export default function AdminPromptsPage() {
  const [list, setList] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Directive | null>(null);
  const [showNew, setShowNew] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<Scope>("global");
  const [scopeKey, setScopeKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  function resetForm() {
    setTitle("");
    setBody("");
    setScope("global");
    setScopeKey("");
    setEnabled(true);
    setEditing(null);
    setShowNew(false);
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/prompt-directives");
    const data = await res.json();
    setList(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(d: Directive) {
    setEditing(d);
    setShowNew(true);
    setTitle(d.title);
    setBody(d.body);
    setScope(d.scope);
    setScopeKey(d.scopeKey || "");
    setEnabled(d.enabled);
  }

  async function save() {
    if (!title.trim() || !body.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }
    if (scope !== "global" && !scopeKey) {
      alert("적용 대상을 선택해주세요.");
      return;
    }
    const payload = { title, body, scope, scopeKey, enabled };
    const url = editing ? `/api/prompt-directives/${editing.id}` : "/api/prompt-directives";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "저장 실패");
      return;
    }
    resetForm();
    load();
  }

  async function toggle(d: Directive) {
    await fetch(`/api/prompt-directives/${d.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, enabled: !d.enabled }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("이 지시문을 삭제하시겠습니까?")) return;
    await fetch(`/api/prompt-directives/${id}`, { method: "DELETE" });
    load();
  }

  // scopeKey 옵션
  const examTypeOptions = Object.entries(EXAM_TYPE_MAP).map(([k, v]) => ({
    value: k,
    label: v.name,
  }));

  const questionTypeOptions: { value: string; label: string }[] = [];
  for (const [examKey, info] of Object.entries(EXAM_TYPE_MAP)) {
    for (const qt of getQuestionTypes(examKey)) {
      questionTypeOptions.push({
        value: qt.code,
        label: `[${info.name}] ${qt.number}번 ${qt.name}`,
      });
    }
  }

  function scopeKeyLabel(d: Directive): string {
    if (d.scope === "global") return "전역";
    if (d.scope === "examType") {
      return EXAM_TYPE_MAP[d.scopeKey as keyof typeof EXAM_TYPE_MAP]?.name || d.scopeKey || "";
    }
    const qt = questionTypeOptions.find((o) => o.value === d.scopeKey);
    return qt?.label || d.scopeKey || "";
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">AI 출제 지시문 (관리자)</h2>
          <p className="text-sm text-gray-500 mt-1">
            여기 등록된 지시문은 AI 문제 생성 시 system prompt에 자동으로 합쳐집니다.
          </p>
        </div>
        {!showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + 지시문 추가
          </button>
        )}
      </div>

      {showNew && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">
            {editing ? "지시문 수정" : "새 지시문"}
          </h3>
          <div>
            <label className="block text-sm text-gray-600 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 내신 어휘 문제는 어형 변형도 활용"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">지시 내용</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="AI에게 전달할 출제 지침을 자세히 입력하세요. 예: 정답 선지의 길이는 다른 선지와 ±5단어 이내로 맞춰라."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">적용 범위</label>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as Scope);
                  setScopeKey("");
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {scope !== "global" && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">대상</label>
                <select
                  value={scopeKey}
                  onChange={(e) => setScopeKey(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">선택하세요</option>
                  {(scope === "examType" ? examTypeOptions : questionTypeOptions).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            활성화 (체크 시 즉시 AI 출제에 적용)
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
            >
              취소
            </button>
            <button
              onClick={save}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {editing ? "수정 저장" : "추가"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-1">등록된 지시문이 없습니다</p>
            <p className="text-sm">+ 지시문 추가 버튼으로 첫 지시문을 만들어보세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((d) => (
              <li key={d.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-800">{d.title}</span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                        {SCOPE_LABELS[d.scope]}
                      </span>
                      {d.scopeKey && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                          {scopeKeyLabel(d)}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          d.enabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {d.enabled ? "활성" : "비활성"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{d.body}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(d.updatedAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <button
                      onClick={() => toggle(d)}
                      className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                    >
                      {d.enabled ? "비활성화" : "활성화"}
                    </button>
                    <button
                      onClick={() => startEdit(d)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
