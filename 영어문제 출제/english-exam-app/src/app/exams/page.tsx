"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EXAM_TYPE_MAP } from "@/lib/question-types";
import type { ExamType } from "@/types";

interface ExamRow {
  id: string;
  title: string;
  examType: string;
  totalPoints: number;
  timeLimit: number | null;
  createdAt: string;
  items: { id: string }[];
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => {
        setExams(data);
        setLoading(false);
      });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이 시험지를 삭제하시겠습니까?")) return;
    await fetch(`/api/exams/${id}`, { method: "DELETE" });
    setExams((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          총 {exams.length}개의 시험지
        </p>
        <Link
          href="/exams/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 시험지 구성
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">시험지가 없습니다</p>
            <Link
              href="/exams/new"
              className="text-blue-600 hover:underline text-sm"
            >
              첫 시험지를 만들어 보세요
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {exams.map((exam) => (
              <li key={exam.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <Link
                    href={`/exams/${exam.id}`}
                    className="text-sm font-medium text-gray-800 hover:text-blue-600"
                  >
                    {exam.title}
                  </Link>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      {EXAM_TYPE_MAP[exam.examType as ExamType]?.name || exam.examType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {exam.items.length}문항 / {exam.totalPoints}점
                    </span>
                    {exam.timeLimit && (
                      <span className="text-xs text-gray-400">
                        {exam.timeLimit}분
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/exams/${exam.id}/preview`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    미리보기
                  </Link>
                  <Link
                    href={`/exams/${exam.id}/edit`}
                    className="text-xs text-amber-600 hover:text-amber-700"
                  >
                    편집
                  </Link>
                  <button
                    onClick={() => handleDelete(exam.id)}
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
