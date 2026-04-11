"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface Passage {
  id: string;
  textbook: string;
  grade: string;
  lesson: string;
  title: string | null;
  content: string;
  wordCount: number;
}

export default function PassageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [textbook, setTextbook] = useState("");
  const [grade, setGrade] = useState("");
  const [lesson, setLesson] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch(`/api/passages/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setPassage(data);
        setTextbook(data.textbook);
        setGrade(data.grade);
        setLesson(data.lesson);
        setTitle(data.title || "");
        setContent(data.content);
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/passages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textbook, grade, lesson, title, content }),
      });
      if (!res.ok) throw new Error("수정 실패");
      const updated = await res.json();
      setPassage(updated);
      setEditing(false);
    } catch {
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 지문을 삭제하시겠습니까?")) return;
    await fetch(`/api/passages/${id}`, { method: "DELETE" });
    router.push("/passages");
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  if (loading) {
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  }

  if (!passage) {
    return <div className="text-center text-gray-400 py-12">지문을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">지문 상세</h2>
        <div className="flex gap-2">
          {!editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        {editing ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">학년</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="중1">중1</option>
                  <option value="중2">중2</option>
                  <option value="중3">중3</option>
                  <option value="고1">고1</option>
                  <option value="고2">고2</option>
                  <option value="고3">고3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">교과서명</label>
                <input
                  type="text"
                  value={textbook}
                  onChange={(e) => setTextbook(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">과/단원</label>
                <input
                  type="text"
                  value={lesson}
                  onChange={(e) => setLesson(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">지문 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm text-gray-600">지문 내용</label>
                <span className="text-xs text-gray-400">{wordCount}단어</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={15}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditing(false);
                  setTextbook(passage.textbook);
                  setGrade(passage.grade);
                  setLesson(passage.lesson);
                  setTitle(passage.title || "");
                  setContent(passage.content);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-700 font-medium">
                {passage.grade}
              </span>
              <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 font-medium">
                {passage.textbook}
              </span>
              <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600 font-medium">
                {passage.lesson}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {passage.wordCount}단어
              </span>
            </div>
            {passage.title && (
              <h3 className="text-lg font-semibold text-gray-800">
                {passage.title}
              </h3>
            )}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {passage.content}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
