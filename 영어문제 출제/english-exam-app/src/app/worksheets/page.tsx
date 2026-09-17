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
  const [equalPoints, setEqualPoints] = useState(true); // 100점 만점 균등분배
  const [recognizing, setRecognizing] = useState(false);

  // 100점 만점을 문항 수만큼 균등 분배(합계 100, 정수). 앞 문항부터 나머지 +1.
  function distributePoints(n: number): number[] {
    if (n <= 0) return [];
    const base = Math.floor(100 / n);
    const rem = 100 - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
  }

  function pointsForIndex(i: number): number {
    if (equalPoints) return distributePoints(items.length)[i] ?? 0;
    return items[i]?.points ?? 0;
  }

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

  // 정답지 이미지/PDF 업로드 → AI 자동 인식 → 문항/정답 채우기
  async function onAnswerKeyFile(file: File) {
    setRecognizing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = reader.result as string;
          resolve(s.split(",")[1] || "");
        };
        reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/worksheets/recognize-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          mediaType: file.type,
          count: items.length || undefined,
        }),
      });
      if (!res.ok) {
        alert((await res.json()).error || "정답 인식 실패");
        return;
      }
      const data = (await res.json()) as {
        items: { number: number; answer: string; objective: boolean }[];
      };
      if (!data.items?.length) {
        alert("정답을 인식하지 못했습니다. 더 선명한 이미지로 다시 시도해 주세요.");
        return;
      }
      const sorted = [...data.items].sort((a, b) => a.number - b.number);
      setCount(sorted.length);
      setItems(
        sorted.map((it) => ({
          answer: it.answer,
          points: 1,
          objective: it.objective,
        }))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "정답 인식 중 오류가 발생했습니다.");
    } finally {
      setRecognizing(false);
    }
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
        points: equalPoints ? distributePoints(items.length)[idx] : it.points,
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
          문제지 링크와 정답키를 등록하면 학생 앱에서 풀고 자동 채점됩니다. 정답지를 업로드하면
          AI가 문항별 정답을 자동 인식하고, 배점은 균등분배(100점 만점) 또는 직접 입력할 수 있어요.
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

        <div className="flex items-center gap-2 flex-wrap">
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

          {/* 정답지 업로드 → 자동 인식 */}
          <label
            className={`px-3 py-2 text-sm rounded-lg cursor-pointer ${
              recognizing
                ? "bg-purple-200 text-purple-500"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            {recognizing ? "정답 인식 중..." : "📄 정답지 업로드(자동 인식)"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              className="hidden"
              disabled={recognizing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAnswerKeyFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* 배점 방식 */}
        <div className="flex items-center gap-4 flex-wrap bg-gray-50 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={equalPoints}
              onChange={(e) => setEqualPoints(e.target.checked)}
            />
            배점 균등분배 (100점 만점을 문항 수로 나눔)
          </label>
          {equalPoints && items.length > 0 && (
            <span className="text-xs text-gray-500">
              문항당 {distributePoints(items.length)[0]}점
              {distributePoints(items.length)[0] !==
                distributePoints(items.length)[items.length - 1] &&
                ` (앞 문항은 +1점, 합계 100점)`}
            </span>
          )}
          {!equalPoints && (
            <span className="text-xs text-gray-500">배점 직접 입력</span>
          )}
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
                {equalPoints ? (
                  <div className="col-span-3 px-2 py-1.5 text-sm text-gray-500 bg-gray-50 rounded-lg text-center">
                    {pointsForIndex(i)}점
                  </div>
                ) : (
                  <input
                    type="number"
                    min={1}
                    value={it.points}
                    onChange={(e) => updateItem(i, { points: Number(e.target.value) })}
                    className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                )}
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
