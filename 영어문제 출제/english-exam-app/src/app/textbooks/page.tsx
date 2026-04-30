"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TextbookRow {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
}

export default function TextbooksPage() {
  const [textbooks, setTextbooks] = useState<TextbookRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/textbooks")
      .then((r) => r.json())
      .then((d) => {
        setTextbooks(d);
        setLoading(false);
      });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이 교재를 삭제하시겠습니까?")) return;
    await fetch(`/api/textbooks/${id}`, { method: "DELETE" });
    setTextbooks((p) => p.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">총 {textbooks.length}권의 교재</p>
        <Link
          href="/textbooks/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 새 교재
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : textbooks.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">교재가 없습니다</p>
            <Link href="/textbooks/new" className="text-blue-600 hover:underline text-sm">
              첫 교재를 만들어 보세요
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {textbooks.map((t) => (
              <li key={t.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <Link
                    href={`/textbooks/${t.id}/edit`}
                    className="text-sm font-medium text-gray-800 hover:text-blue-600"
                  >
                    {t.title}
                  </Link>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    최근 수정: {new Date(t.updatedAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/textbooks/${t.id}/preview`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    미리보기
                  </Link>
                  <Link
                    href={`/textbooks/${t.id}/edit`}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    편집
                  </Link>
                  <button
                    onClick={() => handleDelete(t.id)}
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
    </div>
  );
}
