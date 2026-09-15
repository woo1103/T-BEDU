"use client";

import { useEffect, useState } from "react";

interface Center {
  id: string;
  name: string;
}

interface ClassRow {
  id: string;
  name: string;
  grade: string;
  subject: string;
  code: string;
  active: boolean;
  center: Center;
  _count: { enrollments: number };
}

interface StudentRow {
  id: string;
  joinedAt: string;
  student: {
    id: string;
    name: string;
    grade: string;
    status: string;
    user: { username: string };
  };
}

const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  both: "영어+수학",
};

export default function ClassesPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 생성 폼
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("고1");
  const [subject, setSubject] = useState("both");
  const [centerId, setCenterId] = useState("");
  const [creating, setCreating] = useState(false);

  // 학생 목록 (펼침)
  const [openId, setOpenId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  async function load() {
    const [cRes, clsRes] = await Promise.all([
      fetch("/api/centers"),
      fetch("/api/classes"),
    ]);
    const c = await cRes.json();
    const cls = await clsRes.json();
    setCenters(c.centers || []);
    setClasses(cls.classes || []);
    if (!centerId && c.centers?.[0]) setCenterId(c.centers[0].id);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createClass() {
    if (!name.trim() || !centerId) {
      alert("반 이름과 센터를 입력하세요.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, grade, subject, centerId }),
    });
    setCreating(false);
    if (!res.ok) {
      const e = await res.json();
      alert(e.error || "생성 실패");
      return;
    }
    setName("");
    await load();
  }

  async function regenerateCode(id: string) {
    if (!confirm("반 코드를 새로 발급하면 기존 코드는 사용할 수 없습니다. 계속할까요?"))
      return;
    const res = await fetch(`/api/classes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateCode: true }),
    });
    if (res.ok) await load();
  }

  async function removeClass(id: string) {
    if (!confirm("이 반을 삭제할까요? (등록된 학생 연결도 삭제됩니다)")) return;
    const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (openId === id) setOpenId(null);
      await load();
    }
  }

  async function toggleStudents(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setStudentsLoading(true);
    const res = await fetch(`/api/classes/${id}`);
    const d = await res.json();
    setStudents(d.class?.enrollments || []);
    setStudentsLoading(false);
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => {},
      () => {}
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">반 편성 / 반 코드</h2>
        <p className="text-sm text-gray-500 mt-1">
          반을 만들면 자동으로 발급되는 <b>반 코드</b>를 재원생에게 전달하세요.
          학생 앱에서 코드로 가입하면 재원생으로 등록됩니다.
        </p>
      </div>

      {/* 생성 폼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">새 반 만들기</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="반 이름 (예: 고2 심화 A)"
            className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {["중1", "중2", "중3", "고1", "고2", "고3"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="both">영어+수학</option>
            <option value="english">영어</option>
            <option value="math">수학</option>
          </select>
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <button
            onClick={createClass}
            disabled={creating}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "생성 중..." : "반 만들기"}
          </button>
        </div>
      </div>

      {/* 반 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            반 목록 {loading ? "" : `(${classes.length})`}
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">아직 만든 반이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {classes.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-600">
                      {c.center?.name}
                    </span>
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-500">
                      {c.grade} · {SUBJECT_LABEL[c.subject] || c.subject}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyCode(c.code)}
                      title="클릭하여 복사"
                      className="font-mono text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100"
                    >
                      {c.code} 📋
                    </button>
                    <button
                      onClick={() => toggleStudents(c.id)}
                      className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5"
                    >
                      학생 {c._count.enrollments}명 {openId === c.id ? "▲" : "▼"}
                    </button>
                    <button
                      onClick={() => regenerateCode(c.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      코드 재발급
                    </button>
                    <button
                      onClick={() => removeClass(c.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {openId === c.id && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    {studentsLoading ? (
                      <p className="text-xs text-gray-400">불러오는 중...</p>
                    ) : students.length === 0 ? (
                      <p className="text-xs text-gray-400">등록된 학생이 없습니다.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 text-xs">
                            <th className="py-1">이름</th>
                            <th className="py-1">아이디</th>
                            <th className="py-1">학년</th>
                            <th className="py-1">구분</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s) => (
                            <tr key={s.id} className="border-t border-gray-200">
                              <td className="py-1.5">{s.student.name}</td>
                              <td className="py-1.5 text-gray-500">
                                {s.student.user.username}
                              </td>
                              <td className="py-1.5">{s.student.grade}</td>
                              <td className="py-1.5">
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    s.student.status === "enrolled"
                                      ? "bg-green-50 text-green-600"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {s.student.status === "enrolled"
                                    ? "재원생"
                                    : "비재원생"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
