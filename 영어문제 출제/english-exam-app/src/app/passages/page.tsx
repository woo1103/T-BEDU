"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Passage {
  id: string;
  textbook: string;
  grade: string;
  lesson: string;
  title: string | null;
  content: string;
  wordCount: number;
  createdAt: string;
}

export default function PassagesPage() {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterTextbook, setFilterTextbook] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterGrade) params.set("grade", filterGrade);
    if (filterTextbook) params.set("textbook", filterTextbook);

    fetch(`/api/passages?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPassages(data);
        setLoading(false);
      });
  }, [filterGrade, filterTextbook]);

  const textbooks = [...new Set(passages.map((p) => p.textbook))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">지문 관리</h2>
        <Link
          href="/passages/new"
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          + 지문 등록
        </Link>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-4">
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">전체 학년</option>
            <option value="고1">고1</option>
            <option value="고2">고2</option>
            <option value="고3">고3</option>
            <option value="중1">중1</option>
            <option value="중2">중2</option>
            <option value="중3">중3</option>
          </select>
          {textbooks.length > 0 && (
            <select
              value={filterTextbook}
              onChange={(e) => setFilterTextbook(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">전체 교과서</option>
              {textbooks.map((tb) => (
                <option key={tb} value={tb}>
                  {tb}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 지문 목록 */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">불러오는 중...</div>
      ) : passages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <p className="text-lg mb-2">등록된 지문이 없습니다</p>
          <p className="text-sm">
            <Link
              href="/passages/new"
              className="text-amber-600 hover:underline"
            >
              첫 지문을 등록해 보세요
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {passages.map((p) => (
            <Link
              key={p.id}
              href={`/passages/${p.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-700 font-medium">
                    {p.grade}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 font-medium">
                    {p.textbook}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {p.wordCount}단어
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">
                {p.lesson}
                {p.title && ` - ${p.title}`}
              </p>
              <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
                {p.content.slice(0, 150)}
                {p.content.length > 150 ? "..." : ""}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(p.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
