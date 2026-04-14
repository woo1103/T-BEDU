"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TextbookRow {
  id: string;
  title: string;
  subtitle: string | null;
  themeColor: string;
  createdAt: string;
  chapters: { id: string; pages: { id: string }[] }[];
}

export default function TextbooksPage() {
  const [textbooks, setTextbooks] = useState<TextbookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/textbooks");
    const data = await res.json();
    setTextbooks(data);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await fetch("/api/textbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, subtitle: newSubtitle }),
    });
    setNewTitle("");
    setNewSubtitle("");
    setShowNew(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 교재를 삭제하시겠습니까? 모든 단원·페이지가 함께 삭제됩니다.")) return;
    await fetch(`/api/textbooks/${id}`, { method: "DELETE" });
    setTextbooks((prev) => prev.filter((t) => t.id !== id));
  }

  function pageCount(t: TextbookRow) {
    return t.chapters.reduce((s, c) => s + c.pages.length, 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">총 {textbooks.length}개의 교재</p>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 새 교재
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : textbooks.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">교재가 없습니다</p>
            <button
              onClick={() => setShowNew(true)}
              className="text-blue-600 hover:underline text-sm"
            >
              첫 교재를 만들어 보세요
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {textbooks.map((tb) => (
              <li key={tb.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: tb.themeColor }}
                  >
                    T
                  </div>
                  <div>
                    <Link
                      href={`/textbooks/${tb.id}`}
                      className="text-sm font-medium text-gray-800 hover:text-blue-600"
                    >
                      {tb.title}
                    </Link>
                    {tb.subtitle && (
                      <div className="text-xs text-gray-500 mt-0.5">{tb.subtitle}</div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {tb.chapters.length}단원 / {pageCount(tb)}페이지
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/textbooks/${tb.id}`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    편집
                  </Link>
                  <button
                    onClick={() => handleDelete(tb.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md space-y-4"
          >
            <h2 className="text-lg font-bold text-gray-800">새 교재 만들기</h2>
            <div>
              <label className="block text-xs text-gray-600 mb-1">제목 *</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 고1 영어 내신 대비"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">부제</label>
              <input
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="선택 입력"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                만들기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
