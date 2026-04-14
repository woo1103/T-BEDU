"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Textbook {
  id: string;
  title: string;
  subtitle: string | null;
  themeColor: string;
  chapters: { id: string; title: string; pages: { id: string }[] }[];
}

export default function TextbookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/textbooks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTextbook(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="text-gray-400">불러오는 중...</div>;
  if (!textbook) return <div className="text-gray-400">교재를 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-6">
      <Link href="/textbooks" className="text-sm text-blue-600 hover:underline">
        ← 교재 목록
      </Link>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: textbook.themeColor }}
          >
            T
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{textbook.title}</h2>
            {textbook.subtitle && (
              <p className="text-sm text-gray-500">{textbook.subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">단원 구조</h3>
        {textbook.chapters.length === 0 ? (
          <p className="text-sm text-gray-400">
            단원이 없습니다. (다음 단계에서 단원·페이지 편집 UI를 구현합니다)
          </p>
        ) : (
          <ul className="space-y-2">
            {textbook.chapters.map((ch) => (
              <li
                key={ch.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
              >
                <span className="text-gray-700">{ch.title}</span>
                <span className="text-xs text-gray-400">{ch.pages.length}페이지</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
