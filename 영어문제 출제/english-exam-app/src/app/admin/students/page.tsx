"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClassRef {
  id: string;
  name: string;
  subject: string;
}
interface StudentRow {
  id: string;
  name: string;
  grade: string;
  status: string;
  username: string;
  center: string | null;
  classes: ClassRef[];
}
interface ClassRow {
  id: string;
  name: string;
  center: { name: string };
}

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];
const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  both: "영어+수학",
};

export default function StudentsAdminPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eGrade, setEGrade] = useState("고1");
  const [eStatus, setEStatus] = useState("enrolled");

  async function load() {
    const [sRes, cRes] = await Promise.all([
      fetch("/api/students"),
      fetch("/api/classes"),
    ]);
    setStudents((await sRes.json()).students || []);
    setClasses((await cRes.json()).classes || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function startEdit(s: StudentRow) {
    setEditId(s.id);
    setEName(s.name);
    setEGrade(s.grade);
    setEStatus(s.status);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: eName, grade: eGrade, status: eStatus }),
    });
    if (res.ok) {
      setEditId(null);
      await load();
    } else alert((await res.json()).error || "수정 실패");
  }

  async function removeStudent(s: StudentRow) {
    if (!confirm(`'${s.name}' 학생을 삭제할까요? (계정·제출·성취도 모두 삭제)`)) return;
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function addClass(s: StudentRow, classId: string) {
    if (!classId) return;
    const res = await fetch(`/api/students/${s.id}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });
    if (res.ok) await load();
  }
  async function removeClass(s: StudentRow, classId: string) {
    const res = await fetch(`/api/students/${s.id}/enroll?classId=${classId}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  const filtered = students.filter(
    (s) => !q || s.name.includes(q) || s.username.includes(q)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">학생 관리</h2>
          <p className="text-sm text-gray-500 mt-1">
            학생만 표시됩니다. 이름·학년·반·재원 상태를 확인·수정·삭제할 수 있어요.
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름/아이디 검색"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">학생이 없습니다.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-3">이름</th>
                <th className="text-left px-4 py-3">아이디</th>
                <th className="text-left px-4 py-3">학년</th>
                <th className="text-left px-4 py-3">구분</th>
                <th className="text-left px-4 py-3">반 / 과목</th>
                <th className="text-right px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 align-top">
                  {editId === s.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          value={eName}
                          onChange={(e) => setEName(e.target.value)}
                          className="w-24 border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.username}</td>
                      <td className="px-4 py-3">
                        <select
                          value={eGrade}
                          onChange={(e) => setEGrade(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1"
                        >
                          {GRADES.map((g) => (
                            <option key={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={eStatus}
                          onChange={(e) => setEStatus(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="enrolled">재원생</option>
                          <option value="guest">비재원생</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-400">—</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => saveEdit(s.id)}
                          className="px-3 py-1 bg-[#245B3E] text-white rounded text-xs"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-1 bg-gray-200 rounded text-xs"
                        >
                          취소
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <Link href={`/students/${s.id}`} className="text-blue-600 hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.username}</td>
                      <td className="px-4 py-3">{s.grade}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === "enrolled"
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.status === "enrolled" ? "재원생" : "비재원생"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 items-center">
                          {s.classes.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs"
                            >
                              {c.name}
                              <span className="text-gray-400">
                                ({SUBJECT_LABEL[c.subject] || c.subject})
                              </span>
                              <button
                                onClick={() => removeClass(s, c.id)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            onChange={(e) => addClass(s, e.target.value)}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs text-gray-500"
                          >
                            <option value="">+ 반 배정</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.center.name} {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => startEdit(s)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => removeStudent(s)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs"
                        >
                          삭제
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
