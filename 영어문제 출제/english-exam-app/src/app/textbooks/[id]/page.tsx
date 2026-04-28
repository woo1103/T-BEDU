"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface TextbookPage {
  id: string;
  orderNum: number;
  title: string | null;
}

interface Chapter {
  id: string;
  orderNum: number;
  title: string;
  pages: TextbookPage[];
}

interface Textbook {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  themeColor: string;
  brandText: string;
  logoText: string;
  coverTemplate: string;
  pageTemplate: string;
  chapters: Chapter[];
}

export default function TextbookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);

  // 메타 폼
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("#4FC3F7");
  const [brandText, setBrandText] = useState("");
  const [logoText, setLogoText] = useState("");

  // 추가 입력 상태
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newPageTitleByChapter, setNewPageTitleByChapter] = useState<Record<string, string>>({});

  // 인라인 편집
  const [editingChapter, setEditingChapter] = useState<{ id: string; title: string } | null>(null);
  const [editingPage, setEditingPage] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/textbooks/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data: Textbook = await res.json();
    setTextbook(data);
    setTitle(data.title);
    setSubtitle(data.subtitle || "");
    setDescription(data.description || "");
    setThemeColor(data.themeColor);
    setBrandText(data.brandText);
    setLogoText(data.logoText);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await fetch(`/api/textbooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          description,
          themeColor,
          brandText,
          logoText,
          coverTemplate: textbook?.coverTemplate || "classic",
          pageTemplate: textbook?.pageTemplate || "default",
        }),
      });
      await load();
    } finally {
      setSavingMeta(false);
    }
  }

  // 단원 추가
  async function addChapter() {
    if (!newChapterTitle.trim()) return;
    await fetch(`/api/textbooks/${id}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newChapterTitle }),
    });
    setNewChapterTitle("");
    await load();
  }

  async function saveChapterTitle() {
    if (!editingChapter) return;
    await fetch(`/api/chapters/${editingChapter.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingChapter.title }),
    });
    setEditingChapter(null);
    await load();
  }

  async function deleteChapter(chapterId: string) {
    if (!confirm("이 단원과 하위 페이지·블록이 모두 삭제됩니다. 계속할까요?")) return;
    await fetch(`/api/chapters/${chapterId}`, { method: "DELETE" });
    await load();
  }

  async function moveChapter(index: number, dir: "up" | "down") {
    if (!textbook) return;
    const next = [...textbook.chapters];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    await fetch(`/api/textbooks/${id}/chapters`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((c) => c.id) }),
    });
    await load();
  }

  // 페이지
  async function addPage(chapterId: string) {
    const t = newPageTitleByChapter[chapterId] || "";
    await fetch(`/api/chapters/${chapterId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t || null }),
    });
    setNewPageTitleByChapter((prev) => ({ ...prev, [chapterId]: "" }));
    await load();
  }

  async function savePageTitle() {
    if (!editingPage) return;
    await fetch(`/api/textbook-pages/${editingPage.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingPage.title }),
    });
    setEditingPage(null);
    await load();
  }

  async function deletePage(pageId: string) {
    if (!confirm("이 페이지가 삭제됩니다. 계속할까요?")) return;
    await fetch(`/api/textbook-pages/${pageId}`, { method: "DELETE" });
    await load();
  }

  async function movePage(chapter: Chapter, index: number, dir: "up" | "down") {
    const next = [...chapter.pages];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    await fetch(`/api/chapters/${chapter.id}/pages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((p) => p.id) }),
    });
    await load();
  }

  if (loading) return <div className="text-gray-400">불러오는 중...</div>;
  if (!textbook) return <div className="text-gray-400">교재를 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-6">
      <Link href="/textbooks" className="text-sm text-blue-600 hover:underline">
        ← 교재 목록
      </Link>

      {/* 메타 편집 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-800">교재 정보</h3>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: themeColor }}
          >
            {logoText || "T"}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">제목 *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">부제</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">테마 색</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-10 h-10 rounded border"
                />
                <input
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">브랜드 텍스트</label>
              <input
                value={brandText}
                onChange={(e) => setBrandText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">로고 글자 (1~2자)</label>
              <input
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                maxLength={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={saveMeta}
            disabled={savingMeta}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {savingMeta ? "저장 중..." : "교재 정보 저장"}
          </button>
        </div>
      </div>

      {/* 단원/페이지 구조 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-800">단원 · 페이지</h3>

        {/* 단원 추가 */}
        <div className="flex gap-2">
          <input
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChapter()}
            placeholder="새 단원 제목 (예: Lesson 1. Greetings)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={addChapter}
            disabled={!newChapterTitle.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            + 단원 추가
          </button>
        </div>

        {textbook.chapters.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            단원이 없습니다. 위 입력창으로 첫 단원을 만들어보세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {textbook.chapters.map((ch, ci) => (
              <li key={ch.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* 단원 헤더 */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs text-gray-400 w-6">#{ch.orderNum}</span>
                  {editingChapter?.id === ch.id ? (
                    <>
                      <input
                        value={editingChapter.title}
                        onChange={(e) =>
                          setEditingChapter({ ...editingChapter, title: e.target.value })
                        }
                        onKeyDown={(e) => e.key === "Enter" && saveChapterTitle()}
                        autoFocus
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                      />
                      <button
                        onClick={saveChapterTitle}
                        className="text-xs text-green-600 hover:text-green-700 px-2"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingChapter(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-gray-800 flex-1">{ch.title}</span>
                      <span className="text-xs text-gray-400">{ch.pages.length}페이지</span>
                      <button
                        onClick={() => moveChapter(ci, "up")}
                        disabled={ci === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1 text-sm"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveChapter(ci, "down")}
                        disabled={ci === textbook.chapters.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1 text-sm"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => setEditingChapter({ id: ch.id, title: ch.title })}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => deleteChapter(ch.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>

                {/* 페이지 목록 */}
                <ul className="divide-y divide-gray-50">
                  {ch.pages.map((p, pi) => (
                    <li key={p.id} className="flex items-center gap-2 px-3 py-2 pl-8">
                      <span className="text-xs text-gray-400 w-8">p.{p.orderNum}</span>
                      {editingPage?.id === p.id ? (
                        <>
                          <input
                            value={editingPage.title}
                            onChange={(e) =>
                              setEditingPage({ ...editingPage, title: e.target.value })
                            }
                            onKeyDown={(e) => e.key === "Enter" && savePageTitle()}
                            autoFocus
                            placeholder="페이지 제목 (선택)"
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                          />
                          <button
                            onClick={savePageTitle}
                            className="text-xs text-green-600 hover:text-green-700 px-2"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingPage(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-gray-700 flex-1">
                            {p.title || <span className="text-gray-400">제목 없음</span>}
                          </span>
                          <button
                            onClick={() => movePage(ch, pi, "up")}
                            disabled={pi === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1 text-sm"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => movePage(ch, pi, "down")}
                            disabled={pi === ch.pages.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1 text-sm"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() =>
                              setEditingPage({ id: p.id, title: p.title || "" })
                            }
                            className="text-xs text-blue-600 hover:text-blue-800 px-2"
                          >
                            편집
                          </button>
                          <button
                            onClick={() => deletePage(p.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2"
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </li>
                  ))}

                  {/* 페이지 추가 */}
                  <li className="flex items-center gap-2 px-3 py-2 pl-8 bg-blue-50/30">
                    <input
                      value={newPageTitleByChapter[ch.id] || ""}
                      onChange={(e) =>
                        setNewPageTitleByChapter((prev) => ({
                          ...prev,
                          [ch.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && addPage(ch.id)}
                      placeholder="새 페이지 제목 (선택)"
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => addPage(ch.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 font-medium"
                    >
                      + 페이지 추가
                    </button>
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
