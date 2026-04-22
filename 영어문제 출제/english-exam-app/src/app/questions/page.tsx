"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EXAM_TYPE_MAP, DIFFICULTY_MAP, getQuestionTypeInfo } from "@/lib/question-types";
import type { ExamType, Difficulty } from "@/types";

interface ExamUsage {
  id: string;
  examId: string;
  exam: {
    id: string;
    title: string;
    headerInfo: string | null;
    createdAt: string;
  };
}

interface QuestionRow {
  id: string;
  examType: string;
  questionType: string;
  question: string;
  difficulty: string;
  points: number;
  aiGenerated: boolean;
  createdAt: string;
  examItems?: ExamUsage[];
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterExamType, setFilterExamType] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [historyOf, setHistoryOf] = useState<QuestionRow | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [filterExamType, filterDifficulty]);

  async function fetchQuestions() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterExamType) params.set("examType", filterExamType);
    if (filterDifficulty) params.set("difficulty", filterDifficulty);
    if (search) params.set("search", search);

    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    setQuestions(data);
    setLoading(false);
  }

  function handleSearch() {
    fetchQuestions();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 문제를 삭제하시겠습니까?")) return;
    await fetch(`/api/questions/${id}`, { method: "DELETE" });
    fetchQuestions();
  }

  return (
    <div className="space-y-6">
      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">시험 유형</label>
            <select
              value={filterExamType}
              onChange={(e) => setFilterExamType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(EXAM_TYPE_MAP).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">난이도</label>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(DIFFICULTY_MAP).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">검색</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="발문 또는 지문 검색..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                검색
              </button>
            </div>
          </div>
          <Link
            href="/questions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + 문제 만들기
          </Link>
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-400">불러오는 중...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">문제가 없습니다</p>
            <Link
              href="/questions/new"
              className="text-blue-600 hover:underline text-sm"
            >
              첫 문제를 만들어 보세요
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">유형</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">발문</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">난이도</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">배점</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">출처</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">출제 이력</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">날짜</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {questions.map((q) => {
                const typeInfo = getQuestionTypeInfo(q.examType, q.questionType);
                const diffInfo = DIFFICULTY_MAP[q.difficulty as Difficulty];
                return (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                        {typeInfo ? `${typeInfo.number}번 ${typeInfo.name}` : q.questionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/questions/${q.id}`}
                        className="text-sm text-gray-800 hover:text-blue-600"
                      >
                        {q.question.slice(0, 50)}
                        {q.question.length > 50 ? "..." : ""}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${diffInfo?.color || ""}`}>
                        {diffInfo?.name || q.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{q.points}점</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          q.aiGenerated
                            ? "bg-purple-50 text-purple-600"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {q.aiGenerated ? "AI" : "수동"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {q.examItems && q.examItems.length > 0 ? (
                        <button
                          onClick={() => setHistoryOf(q)}
                          className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded"
                        >
                          {q.examItems.length}회 출제
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {historyOf && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setHistoryOf(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">출제 이력</h3>
              <button
                onClick={() => setHistoryOf(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 border-b border-gray-100 pb-3">
              {historyOf.question.slice(0, 80)}
              {historyOf.question.length > 80 ? "..." : ""}
            </p>
            <ul className="space-y-2">
              {(historyOf.examItems || [])
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.exam.createdAt).getTime() -
                    new Date(a.exam.createdAt).getTime()
                )
                .map((item) => {
                  let school = "";
                  let grade = "";
                  try {
                    if (item.exam.headerInfo) {
                      const h = JSON.parse(item.exam.headerInfo);
                      school = h.school || "";
                      grade = h.grade || "";
                    }
                  } catch {}
                  return (
                    <li
                      key={item.id}
                      className="p-3 rounded-lg border border-gray-200"
                    >
                      <Link
                        href={`/exams/${item.examId}/preview`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {item.exam.title}
                      </Link>
                      <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                        <span>
                          {new Date(item.exam.createdAt).toLocaleDateString(
                            "ko-KR"
                          )}
                        </span>
                        {(school || grade) && (
                          <span>
                            {[school, grade].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
