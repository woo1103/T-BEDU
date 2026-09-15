"use client";

import { useEffect, useState } from "react";

interface Tag {
  id: string;
  name: string;
  kind: string;
  subject: string;
}

const SUBJECT_LABEL: Record<string, string> = { english: "영어", math: "수학" };

export function QuestionTagEditor({ questionId }: { questionId: string }) {
  const [all, setAll] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [tagsRes, curRes] = await Promise.all([
        fetch("/api/tags"),
        fetch(`/api/questions/${questionId}/tags`),
      ]);
      const t = await tagsRes.json();
      const c = await curRes.json();
      setAll(t.tags || []);
      setSelected(new Set<string>(c.tagIds || []));
      setLoaded(true);
    })();
  }, [questionId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setSavedMsg("");
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/questions/${questionId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: [...selected] }),
    });
    setSaving(false);
    setSavedMsg("저장됨");
  }

  // subject > kind 그룹
  const grouped = new Map<string, Map<string, Tag[]>>();
  for (const t of all) {
    if (!grouped.has(t.subject)) grouped.set(t.subject, new Map());
    const km = grouped.get(t.subject)!;
    if (!km.has(t.kind)) km.set(t.kind, []);
    km.get(t.kind)!.push(t);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500">태그 (능력영역·단원·개념)</h3>
        <div className="flex items-center gap-2">
          {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
          <button
            onClick={save}
            disabled={saving || !loaded}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "태그 저장"}
          </button>
        </div>
      </div>

      {!loaded ? (
        <p className="text-xs text-gray-400">불러오는 중...</p>
      ) : all.length === 0 ? (
        <p className="text-xs text-gray-400">
          등록된 태그가 없습니다. &lsquo;문항 태그&rsquo; 메뉴에서 추가하세요.
        </p>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([subj, kinds]) => (
            <div key={subj}>
              <p className="text-xs text-gray-400 mb-1">{SUBJECT_LABEL[subj] || subj}</p>
              <div className="space-y-2">
                {Array.from(kinds.entries()).map(([k, list]) => (
                  <div key={k} className="flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] text-gray-400 w-8">{k}</span>
                    {list.map((t) => {
                      const on = selected.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggle(t.id)}
                          className={`px-3 py-1 rounded-full text-xs transition-colors ${
                            on
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
