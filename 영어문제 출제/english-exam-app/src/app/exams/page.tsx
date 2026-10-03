"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EXAM_TYPE_MAP } from "@/lib/question-types";
import SourceTree from "@/components/SourceTree";
import type { ExamType } from "@/types";

interface ExamRow {
  id: string;
  title: string;
  examType: string;
  grade: string | null;
  source: string | null;
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
  // 개인(복수) 선택
  const [assignStudents, setAssignStudents] = useState<{ id: string; name: string }[]>([]);
  const [assignStudentIds, setAssignStudentIds] = useState<Set<string>>(new Set());
  const [studentsLoading, setStudentsLoading] = useState(false);

  // 반 선택 시 그 반 학생을 불러와 전원 체크
  async function loadClassStudents(classId: string) {
    if (!classId) {
      setAssignStudents([]);
      setAssignStudentIds(new Set());
      return;
    }
    setStudentsLoading(true);
    try {
      const d = await (await fetch(`/api/classes/${classId}`)).json();
      const list = (d.class?.enrollments || []).map(
        (e: { student: { id: string; name: string } }) => ({
          id: e.student.id,
          name: e.student.name,
        })
      );
      setAssignStudents(list);
      setAssignStudentIds(new Set(list.map((s: { id: string }) => s.id)));
    } catch {
      setAssignStudents([]);
      setAssignStudentIds(new Set());
    } finally {
      setStudentsLoading(false);
    }
  }

  function toggleAssignStudent(id: string) {
    setAssignStudentIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

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
    const first = classes[0]?.id ?? "";
    setAssignClassId(first);
    setAssignDue("");
    loadClassStudents(first);
  }

  async function submitAssign() {
    if (!assignTarget || !assignClassId) {
      alert("배정할 반을 선택하세요.");
      return;
    }
    if (assignStudents.length > 0 && assignStudentIds.size === 0) {
      alert("대상 학생을 1명 이상 선택하세요.");
      return;
    }
    setAssigning(true);
    try {
      // 전원 선택이면 반 전체(studentIds 생략), 일부면 지정 학생만
      const allSelected =
        assignStudents.length > 0 && assignStudentIds.size === assignStudents.length;
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: assignClassId,
          examId: assignTarget.id,
          dueAt: assignDue ? new Date(assignDue).toISOString() : undefined,
          studentIds: allSelected ? undefined : [...assignStudentIds],
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
          <SourceTree
            items={exams.map((e) => ({ ...e, subject: "english" }))}
            renderItem={(exam) => (
              <div className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <Link
                    href={`/exams/${exam.id}`}
                    className="text-sm font-medium text-gray-800 hover:text-blue-600"
                  >
                    {exam.title}
                  </Link>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      {EXAM_TYPE_MAP[exam.examType as ExamType]?.name || exam.examType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {exam.items.length}문항 / {exam.totalPoints}점
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => openAssign(exam)}
                    className="text-xs px-3 py-1.5 bg-[#245B3E] text-white rounded-lg hover:bg-[#1d4a32]"
                  >
                    반 배정
                  </button>
                  <Link href={`/exams/${exam.id}/preview`} className="text-xs text-blue-600 hover:text-blue-700">
                    미리보기
                  </Link>
                  <Link href={`/exams/${exam.id}/edit`} className="text-xs text-amber-600 hover:text-amber-700">
                    편집
                  </Link>
                  <button onClick={() => handleDelete(exam.id)} className="text-xs text-red-500 hover:text-red-700">
                    삭제
                  </button>
                </div>
              </div>
            )}
          />
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
                    onChange={(e) => {
                      setAssignClassId(e.target.value);
                      loadClassStudents(e.target.value);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.center.name} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 대상 학생(개인 복수 선택) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-600">
                      대상 학생 ({assignStudentIds.size}/{assignStudents.length})
                    </label>
                    {assignStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAssignStudentIds((prev) =>
                            prev.size === assignStudents.length
                              ? new Set()
                              : new Set(assignStudents.map((s) => s.id))
                          )
                        }
                        className="text-xs text-[#245B3E] hover:underline"
                      >
                        전체 선택/해제
                      </button>
                    )}
                  </div>
                  {studentsLoading ? (
                    <p className="text-xs text-gray-400 py-2">불러오는 중...</p>
                  ) : assignStudents.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">이 반에 학생이 없습니다.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                      {assignStudents.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={assignStudentIds.has(s.id)}
                            onChange={() => toggleAssignStudent(s.id)}
                          />
                          <span className="text-gray-700">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    전원 선택 시 반 전체(이후 가입 학생도 자동 포함), 일부만 선택하면 그 학생만 배정됩니다.
                  </p>
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
