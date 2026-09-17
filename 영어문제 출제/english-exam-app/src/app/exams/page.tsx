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

interface ClassRow {
  id: string;
  name: string;
  center: { name: string };
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 반 배정(과제 할당) 모달
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignTarget, setAssignTarget] = useState<ExamRow | null>(null);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => {
        setExams(data);
        setLoading(false);
      });
    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => setClasses(data.classes || []))
      .catch(() => {});
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이 시험지를 삭제하시겠습니까?")) return;
    await fetch(`/api/exams/${id}`, { method: "DELETE" });
    setExams((prev) => prev.filter((e) => e.id !== id));
  }

  function openAssign(exam: ExamRow) {
    setAssignTarget(exam);
    setAssignClassId(classes[0]?.id ?? "");
    setAssignDue("");
  }

  async function submitAssign() {
    if (!assignTarget || !assignClassId) {
      alert("배정할 반을 선택하세요.");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: assignClassId,
          examId: assignTarget.id,
          dueAt: assignDue ? new Date(assignDue).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        alert((await res.json()).error || "배정 실패");
        return;
      }
      const cls = classes.find((c) => c.id === assignClassId);
      alert(`'${cls?.name ?? "반"}'에 '${assignTarget.title}' 과제를 배정했습니다.`);
      setAssignTarget(null);
    } catch {
      alert("배정 중 오류가 발생했습니다.");
    } finally {
      setAssigning(false);
    }
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
                  <button
                    onClick={() => openAssign(exam)}
                    className="text-xs px-3 py-1.5 bg-[#245B3E] text-white rounded-lg hover:bg-[#1d4a32]"
                  >
                    반 배정
                  </button>
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

      {/* 반 배정(과제 할당) 모달 */}
      {assignTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !assigning && setAssignTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800">반 배정 (과제 할당)</h3>
              <p className="text-sm text-gray-500 mt-1 truncate">
                시험지: <span className="font-medium">{assignTarget.title}</span>
              </p>
            </div>

            {classes.length === 0 ? (
              <p className="text-sm text-gray-500">
                먼저 반을 만들어 주세요. (반 편성)
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">배정할 반</label>
                  <select
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.center.name} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    마감일 (선택)
                  </label>
                  <input
                    type="datetime-local"
                    value={assignDue}
                    onChange={(e) => setAssignDue(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssignTarget(null)}
                disabled={assigning}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={submitAssign}
                disabled={assigning || classes.length === 0}
                className="px-4 py-2 bg-[#245B3E] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {assigning ? "배정 중..." : "배정하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
