"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPassagePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [textbook, setTextbook] = useState("");
  const [grade, setGrade] = useState("고1");
  const [lesson, setLesson] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  async function handleSave() {
    if (!textbook.trim() || !lesson.trim() || !content.trim()) {
      alert("교과서명, 단원, 지문 내용은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/passages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textbook, grade, lesson, title, content }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.push("/passages");
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">지문 등록</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
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
              placeholder="예: 능률 영어I"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">과/단원</label>
            <input
              type="text"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="예: Lesson 3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            지문 제목 (선택)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: The Power of Emotional Intelligence"
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
            placeholder="교과서 영어 지문을 붙여넣기 하세요..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "지문 저장"}
        </button>
      </div>
    </div>
  );
}
