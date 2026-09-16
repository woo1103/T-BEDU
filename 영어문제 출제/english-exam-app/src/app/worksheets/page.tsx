"use client";

import { useEffect, useState } from "react";

interface Tag {
  id: string;
  name: string;
  kind: string;
  subject: string;
}
interface WorksheetRow {
  id: string;
  title: string;
  grade: string | null;
  fileUrl: string | null;
  _count: { items: number };
}
interface ClassRow {
  id: string;
  name: string;
  center: { name: string };
}
interface ItemDraft {
  answer: string;
  points: number;
  objective: boolean; // 객관식이면 choicesCount=5
}

export default function WorksheetsPage() {
  const [worksheets, setWorksheets] = useState<WorksheetRow[]>([]);
  const [mathTags, setMathTags] = useState<Tag[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 생성 폼
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("고1");
  const [source, setSource] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [unitTagId, setUnitTagId] = useState("");
  const [count, setCount] = useState(5);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [wRes, tRes, cRes] = await Promise.all([
      fetch("/api/worksheets"),
      fetch("/api/tags?subject=math"),
      fetch("/api/classes"),
    ]);
    setWorksheets((await wRes.json()).worksheets || []);
    setMathTags((await tRes.json()).tags || []);
    setClasses((await cRes.json()).classes || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function genRows() {
    setItems(
      Array.from({ length: Math.max(1, count) }, () => ({
        answer: "",
        points: 1,
        objective: true,
      }))
    );
  }

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function save() {
    if (!title.trim() || items.length === 0) {
      alert("제목과 문항을 입력하세요.");
      return;
    }
    if (items.some((it) => !it.answer.trim())) {
      alert("모든 문항의 정답을 입력하세요.");
      return;
    }
    setSaving(true);
    const payload = {
      title,
      grade,
      source,
      fileUrl,
      items: items.map((it, idx) => ({
        number: idx + 1,
        answer: it.answer.trim(),
        points: it.points,
        choicesCount: it.objective ? 5 : null,
        tagIds: unitTagId ? [unitTagId] : [],
      })),
    };
    const res = await fetch("/api/worksheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      alert((await res.json()).error || "저장 실패");
      return;
    }
    setTitle("");
    setFileUrl("");
    setSource("");
    setItems([]);
    await load();
  }

  async function assign(ws: WorksheetRow) {
    if (classes.length === 0) {
      alert("먼저 반을 만들어 주세요.");
      return;
    }
    const list = classes.map((c, i) => `${i + 1}. ${c.center.name} ${c.name}`).join("\n");
    const pick = prompt(`배정할 반 번호를 입력하세요:\n${list}`);
    if (!pick) return;
    const idx = parseInt(pick, 10) - 1;
    const cls = classes[idx];
    if (!cls) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: cls.id, worksheetId: ws.id }),
    });
    if (res.ok) alert(`'${cls.name}'에 배정되었습니다.`);
    else alert((await res.json()).error || "배정 실패");
  }

  async function remove(ws: WorksheetRow) {
    if (!confirm("이 문제지를 삭제할까요?")) return;
    const res = await fetch(`/api/worksheets/${ws.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const unitTags = mathTags.filter((t) => t.kind === "단원" || t.kind === "영역");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">수학 문제지</h2>
        <p className="text-sm text-gray-500 mt-1">
          문제지 이미지/PDF 링크와 정답키를 등록하면, 학생 앱에서 풀고 자동 채점됩니다.
        </p>
      </div>

      {/* 생성 폼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">새 문제지 등록</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (예: 수1 3단원 미니테스트)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="출처 (선택)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="문제지 이미지/PDF URL"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {["중1", "중2", "중3", "고1", "고2", "고3"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={unitTagId}
            onChange={(e) => setUnitTagId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">단원 태그 없음</option>
            {unitTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">문항 수</label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={genRows}
            className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg"
          >
            문항 생성
          </button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1">
              <span className="col-span-1">번호</span>
              <span className="col-span-5">정답</span>
              <span className="col-span-3">배점</span>
              <span className="col-span-3">유형</span>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-1 text-sm text-gray-600 text-center">
                  {i + 1}
                </span>
                <input
                  value={it.answer}
                  onChange={(e) => updateItem(i, { answer: e.target.value })}
                  placeholder={it.objective ? "①~⑤" : "정답(주관식)"}
                  className="col-span-5 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={it.points}
                  onChange={(e) => updateItem(i, { points: Number(e.target.value) })}
                  className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
                <label className="col-span-3 flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={it.objective}
                    onChange={(e) => updateItem(i, { objective: e.target.checked })}
                  />
                  객관식
                </label>
              </div>
            ))}
            <button
              onClick={save}
              disabled={saving}
              className="mt-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? "저장 중..." : "문제지 저장"}
            </button>
          </div>
        )}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 font-semibold text-gray-800">
          등록된 문제지 {loading ? "" : `(${worksheets.length})`}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : worksheets.length === 0 ? (
          <div className="p-8 text-center text-gray-400">등록된 문제지가 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {worksheets.map((ws) => (
              <li key={ws.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{ws.title}</p>
                  <p className="text-xs text-gray-400">
                    {ws.grade} · {ws._count.items}문항
                    {ws.fileUrl ? " · 파일 링크 있음" : " · 파일 없음"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => assign(ws)}
                    className="text-sm px-3 py-1.5 bg-[#245B3E] text-white rounded-lg"
                  >
                    반 배정
                  </button>
                  <button
                    onClick={() => remove(ws)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
