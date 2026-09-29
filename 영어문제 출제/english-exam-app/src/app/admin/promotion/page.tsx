"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Term {
  id: string;
  name: string;
  year: number;
  isCurrent: boolean;
  _count: { classes: number };
}
interface ClassRow {
  id: string;
  name: string;
  grade: string;
  center: { name: string };
  term?: { id: string } | null;
  _count: { enrollments: number };
}
interface Plan {
  include: boolean;
  newName: string;
  newGrade: string;
  graduate: boolean;
}

const GRADE_SEQ = ["중1", "중2", "중3", "고1", "고2", "고3"];
function nextGrade(g: string): string {
  const i = GRADE_SEQ.indexOf(g);
  return i >= 0 && i < GRADE_SEQ.length - 1 ? GRADE_SEQ[i + 1] : "졸업";
}

export default function PromotionPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [sourceTermId, setSourceTermId] = useState<string>("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [newTermName, setNewTermName] = useState("");
  const [newTermYear, setNewTermYear] = useState<number>(new Date().getFullYear() + 1);
  const [copyVideos, setCopyVideos] = useState(false);
  const [copyAssignments, setCopyAssignments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await (await fetch("/api/terms")).json();
      const list: Term[] = t.terms || [];
      setTerms(list);
      const cur = list.find((x) => x.isCurrent) || list[0];
      if (cur) {
        setSourceTermId(cur.id);
        setNewTermName(`${cur.year + 1}학년도`);
        setNewTermYear(cur.year + 1);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!sourceTermId) return;
    (async () => {
      const c = await (await fetch(`/api/classes?termId=${sourceTermId}`)).json();
      const rows: ClassRow[] = c.classes || [];
      setClasses(rows);
      const p: Record<string, Plan> = {};
      for (const r of rows) {
        const ng = nextGrade(r.grade);
        p[r.id] = {
          include: true,
          newName: r.name.replace(r.grade, ng) === r.name ? r.name : r.name.replace(r.grade, ng),
          newGrade: ng === "졸업" ? r.grade : ng,
          graduate: ng === "졸업",
        };
      }
      setPlans(p);
    })();
  }, [sourceTermId]);

  function patch(id: string, patch: Partial<Plan>) {
    setPlans((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function submit() {
    const selected = classes.filter((c) => plans[c.id]?.include);
    if (selected.length === 0) {
      alert("진급할 반을 1개 이상 선택하세요.");
      return;
    }
    if (!newTermName.trim()) {
      alert("새 학년도 이름을 입력하세요.");
      return;
    }
    if (
      !confirm(
        `${selected.length}개 반을 '${newTermName}'(으)로 진급 처리합니다.\n` +
          `기존 반은 이전 학년도로 보존되고 학생은 새 반으로 이동합니다. 계속할까요?`
      )
    )
      return;
    setSubmitting(true);
    const res = await fetch("/api/promotion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newTerm: { name: newTermName.trim(), year: newTermYear },
        plans: selected.map((c) => ({
          classId: c.id,
          graduate: plans[c.id].graduate,
          newName: plans[c.id].newName,
          newGrade: plans[c.id].newGrade,
        })),
        copyVideos,
        copyAssignments,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const r = await res.json();
      setDone(
        `완료: 새 반 ${r.newClasses}개 · 이동 학생 ${r.movedStudents}명 · 졸업 ${r.graduated}명`
      );
    } else {
      alert((await res.json()).error || "진급 실패");
    }
  }

  if (loading)
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">진급 마법사</h2>
          <p className="text-sm text-gray-500 mt-1">
            새 학년도로 반을 복제하고 학생을 일괄 이동합니다. 기존 학년도는 이력으로 보존됩니다.
          </p>
        </div>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">
          ← 반 편성
        </Link>
      </div>

      {done ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <p className="text-lg font-semibold text-[#245B3E]">✅ 진급 완료</p>
          <p className="text-sm text-gray-600">{done}</p>
          <Link
            href="/classes"
            className="inline-block px-5 py-2.5 bg-[#245B3E] text-white text-sm rounded-lg"
          >
            반 편성으로 이동
          </Link>
        </div>
      ) : (
        <>
          {/* 대상 학년도 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">진급 대상(이전) 학년도</label>
                <select
                  value={sourceTermId}
                  onChange={(e) => setSourceTermId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isCurrent ? "(현재)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">새 학년도 이름</label>
                <input
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">연도</label>
                <input
                  type="number"
                  value={newTermYear}
                  onChange={(e) => setNewTermYear(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={copyVideos} onChange={(e) => setCopyVideos(e.target.checked)} />
                영상 노출 복사
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={copyAssignments} onChange={(e) => setCopyAssignments(e.target.checked)} />
                과제 복사
              </label>
            </div>
          </div>

          {/* 반별 계획 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            {classes.length === 0 ? (
              <div className="p-8 text-center text-gray-400">이 학년도에 반이 없습니다.</div>
            ) : (
              <table className="w-full text-sm min-w-[680px]">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-2">진급</th>
                    <th className="text-left px-4 py-2">기존 반</th>
                    <th className="text-left px-4 py-2">새 반 이름</th>
                    <th className="text-left px-4 py-2">새 학년</th>
                    <th className="text-left px-4 py-2">졸업</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => {
                    const p = plans[c.id];
                    if (!p) return null;
                    return (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={p.include}
                            onChange={(e) => patch(c.id, { include: e.target.checked })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-gray-800">{c.name}</div>
                          <div className="text-xs text-gray-400">
                            {c.center.name} · {c.grade} · {c._count.enrollments}명
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={p.newName}
                            disabled={p.graduate}
                            onChange={(e) => patch(c.id, { newName: e.target.value })}
                            className="w-40 border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={p.newGrade}
                            disabled={p.graduate}
                            onChange={(e) => patch(c.id, { newGrade: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                          >
                            {GRADE_SEQ.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={p.graduate}
                            onChange={(e) => patch(c.id, { graduate: e.target.checked })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="px-6 py-3 bg-[#245B3E] text-white rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? "진급 처리 중..." : "진급 실행"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
