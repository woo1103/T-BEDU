"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EXAM_TYPE_MAP, getQuestionTypeInfo } from "@/lib/question-types";
import type { ExamType, Choice } from "@/types";

interface QuestionRow {
  id: string;
  examType: string;
  questionType: string;
  question: string;
  passage: string;
  choices: string;
  answer: string;
  explanation: string | null;
  difficulty: string;
  points: number;
  source: string | null;
  aiGenerated: boolean;
  passageId: string | null;
  createdAt?: string;
  passageRef: {
    id: string;
    textbook: string;
    grade: string;
    lesson: string;
    title: string | null;
  } | null;
}

interface ExamItemDetail {
  id: string;
  questionId: string;
  orderNum: number;
  customPoints: number | null;
  question: QuestionRow;
}

interface ExamDetail {
  id: string;
  title: string;
  examType: string;
  description: string | null;
  totalPoints: number;
  timeLimit: number | null;
  headerInfo: string | null;
  instructions: string | null;
  items: ExamItemDetail[];
}

interface SelectedItem {
  questionId: string;
  question: QuestionRow;
  orderNum: number;
  customPoints?: number | null;
}

type SortMode = "tree" | "date" | "grade" | "textbook";

export default function ExamEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<ExamType>("suneung");
  const [timeLimit, setTimeLimit] = useState<number | undefined>(undefined);
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [date, setDate] = useState("");
  const [instructions, setInstructions] = useState("");

  const [availableQuestions, setAvailableQuestions] = useState<QuestionRow[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [detailQuestion, setDetailQuestion] = useState<QuestionRow | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("tree");
  const [search, setSearch] = useState("");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkCheckedIds, setBulkCheckedIds] = useState<Set<string>>(new Set());
  const [bulkExpanded, setBulkExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch(`/api/exams/${id}`).then((r) => r.json()),
      fetch(`/api/questions`).then((r) => r.json()),
    ]).then(([exam, qs]: [ExamDetail, QuestionRow[]]) => {
      setTitle(exam.title);
      setExamType(exam.examType as ExamType);
      setTimeLimit(exam.timeLimit || undefined);
      setInstructions(exam.instructions || "");
      try {
        if (exam.headerInfo) {
          const h = JSON.parse(exam.headerInfo);
          setSchool(h.school || "");
          setGrade(h.grade || "");
          setDate(h.date || "");
        }
      } catch {}
      setSelectedItems(
        exam.items
          .sort((a, b) => a.orderNum - b.orderNum)
          .map((it) => ({
            questionId: it.questionId,
            question: it.question,
            orderNum: it.orderNum,
            customPoints: it.customPoints,
          }))
      );
      setAvailableQuestions(qs);
      setLoading(false);
    });
  }, [id]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCheck(qid: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }

  function addQuestion(q: QuestionRow) {
    if (selectedItems.find((i) => i.questionId === q.id)) return;
    setSelectedItems((prev) => [
      ...prev,
      { questionId: q.id, question: q, orderNum: prev.length + 1 },
    ]);
  }

  function addQuestions(qs: QuestionRow[]) {
    setSelectedItems((prev) => {
      const existing = new Set(prev.map((i) => i.questionId));
      const toAdd = qs.filter((q) => !existing.has(q.id));
      const merged = [
        ...prev,
        ...toAdd.map((q) => ({ questionId: q.id, question: q, orderNum: 0 })),
      ];
      return merged.map((it, i) => ({ ...it, orderNum: i + 1 }));
    });
  }

  function addCheckedQuestions() {
    const qs = availableQuestions.filter((q) => checkedIds.has(q.id));
    addQuestions(qs);
    setCheckedIds(new Set());
  }

  // ─── 교재별 일괄 추가 모달용 ───
  function bulkToggleExpanded(key: string) {
    setBulkExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function bulkToggle(ids: string[]) {
    setBulkCheckedIds((prev) => {
      const next = new Set(prev);
      const allChecked = ids.every((id) => next.has(id));
      if (allChecked) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  function bulkBuildByTextbook(): Map<string, Map<string, Map<string, QuestionRow[]>>> {
    // 교재 → 과/단원 → 지문 → 문제[]
    const tree = new Map<string, Map<string, Map<string, QuestionRow[]>>>();
    for (const q of availableQuestions) {
      const tb = q.passageRef?.textbook || "교과서 미연결";
      const ls = q.passageRef?.lesson || "단원 미지정";
      const pTitle = q.passageRef?.title || (q.passageRef ? `지문 ${q.passageRef.id.slice(-4)}` : "지문 없음");
      if (!tree.has(tb)) tree.set(tb, new Map());
      const l2 = tree.get(tb)!;
      if (!l2.has(ls)) l2.set(ls, new Map());
      const l3 = l2.get(ls)!;
      if (!l3.has(pTitle)) l3.set(pTitle, []);
      l3.get(pTitle)!.push(q);
    }
    return tree;
  }

  function addBulkChecked() {
    const qs = availableQuestions.filter((q) => bulkCheckedIds.has(q.id));
    const existing = new Set(selectedItems.map((i) => i.questionId));
    const dup = qs.filter((q) => existing.has(q.id)).length;
    const added = qs.length - dup;
    addQuestions(qs);
    setBulkCheckedIds(new Set());
    setBulkModalOpen(false);
    setTimeout(() => {
      alert(`${added}개 추가됨${dup > 0 ? ` · ${dup}개 중복 건너뜀` : ""}`);
    }, 50);
  }

  function removeQuestion(qid: string) {
    setSelectedItems((prev) =>
      prev.filter((i) => i.questionId !== qid).map((it, i) => ({ ...it, orderNum: i + 1 }))
    );
  }

  function moveItem(index: number, dir: "up" | "down") {
    const next = [...selectedItems];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setSelectedItems(next.map((it, i) => ({ ...it, orderNum: i + 1 })));
  }

  // 검색 필터
  const filteredQuestions = search.trim()
    ? availableQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(search.toLowerCase()) ||
          q.passage.toLowerCase().includes(search.toLowerCase())
      )
    : availableQuestions;

  // 평면 정렬 모드용 (정렬 후 그룹핑)
  function flatGroups(): { key: string; label: string; items: QuestionRow[] }[] {
    if (sortMode === "date") {
      const byDay = new Map<string, QuestionRow[]>();
      for (const q of filteredQuestions) {
        const day = q.createdAt ? new Date(q.createdAt).toLocaleDateString("ko-KR") : "날짜 미상";
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(q);
      }
      return Array.from(byDay.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([k, v]) => ({ key: `d::${k}`, label: k, items: v }));
    }
    if (sortMode === "grade") {
      const byGrade = new Map<string, QuestionRow[]>();
      for (const q of filteredQuestions) {
        const g = q.passageRef?.grade || "학년 미연결";
        if (!byGrade.has(g)) byGrade.set(g, []);
        byGrade.get(g)!.push(q);
      }
      return Array.from(byGrade.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ key: `g::${k}`, label: k, items: v }));
    }
    if (sortMode === "textbook") {
      const byTb = new Map<string, QuestionRow[]>();
      for (const q of filteredQuestions) {
        const t = q.passageRef?.textbook || "교과서 미연결";
        if (!byTb.has(t)) byTb.set(t, []);
        byTb.get(t)!.push(q);
      }
      return Array.from(byTb.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ key: `t::${k}`, label: k, items: v }));
    }
    return [];
  }

  // 트리 모드
  type L5 = Map<string, QuestionRow[]>;
  type L4 = Map<string, L5>;
  type L3 = Map<string, L4>;
  type L2 = Map<string, L3>;
  type QuestionTree = Map<string, L2>;

  function buildTree(): { tree: QuestionTree; orphans: QuestionRow[] } {
    const tree: QuestionTree = new Map();
    const orphans: QuestionRow[] = [];
    for (const q of filteredQuestions) {
      if (!q.passageRef) {
        orphans.push(q);
        continue;
      }
      const { grade: g, textbook, lesson, title: pTitle, id: pid } = q.passageRef;
      const passageLabel = pTitle || `지문 ${pid.slice(-4)}`;
      const ti = getQuestionTypeInfo(q.examType, q.questionType);
      const typeLabel = ti ? `${ti.number}번 ${ti.name}` : q.questionType;
      if (!tree.has(g)) tree.set(g, new Map());
      const l2 = tree.get(g)!;
      if (!l2.has(textbook)) l2.set(textbook, new Map());
      const l3 = l2.get(textbook)!;
      if (!l3.has(lesson)) l3.set(lesson, new Map());
      const l4 = l3.get(lesson)!;
      if (!l4.has(passageLabel)) l4.set(passageLabel, new Map());
      const l5 = l4.get(passageLabel)!;
      if (!l5.has(typeLabel)) l5.set(typeLabel, []);
      l5.get(typeLabel)!.push(q);
    }
    return { tree, orphans };
  }

  function countTree(m: Map<string, unknown>): number {
    let n = 0;
    for (const v of m.values()) {
      if (v instanceof Map) n += countTree(v);
      else if (Array.isArray(v)) n += v.length;
    }
    return n;
  }

  function collectQuestions(node: unknown): QuestionRow[] {
    if (Array.isArray(node)) return node as QuestionRow[];
    if (node instanceof Map) {
      const out: QuestionRow[] = [];
      for (const v of node.values()) out.push(...collectQuestions(v));
      return out;
    }
    return [];
  }

  const calculatedTotal = selectedItems.reduce(
    (sum, it) => sum + (it.customPoints || it.question.points),
    0
  );

  async function handleSave() {
    if (!title.trim()) {
      alert("시험지 제목을 입력해주세요.");
      return;
    }
    if (selectedItems.length === 0) {
      alert("최소 1개 이상의 문제를 추가해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          examType,
          totalPoints: calculatedTotal,
          timeLimit,
          headerInfo: { school, grade, date: date || new Date().toISOString().split("T")[0] },
          instructions,
          items: selectedItems.map((it) => ({
            questionId: it.questionId,
            orderNum: it.orderNum,
            customPoints: it.customPoints,
          })),
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.push(`/exams/${id}/preview`);
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  }

  const renderQuestion = (q: QuestionRow) => {
    const isSelected = selectedItems.some((i) => i.questionId === q.id);
    const isChecked = checkedIds.has(q.id);
    const diffLabel = { easy: "하", medium: "중", hard: "상" }[q.difficulty] || q.difficulty;
    return (
      <li
        key={q.id}
        className={`p-2 rounded border text-sm transition-colors ${
          isSelected ? "border-blue-300 bg-blue-50 opacity-60" : "border-gray-200 hover:border-blue-300"
        }`}
      >
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isSelected}
            onChange={() => toggleCheck(q.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex gap-1.5 flex-wrap mb-1">
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {diffLabel} · {q.points}점
              </span>
              {q.aiGenerated && (
                <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">AI</span>
              )}
              {q.passageRef && (
                <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {q.passageRef.textbook} · {q.passageRef.lesson}
                </span>
              )}
            </div>
            <p className="text-gray-700 truncate">{q.question}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setDetailQuestion(q)}
                className="text-xs text-gray-500 hover:text-blue-600 underline"
              >
                상세보기
              </button>
              {!isSelected ? (
                <button
                  onClick={() => addQuestion(q)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto"
                >
                  + 추가
                </button>
              ) : (
                <span className="text-xs text-gray-400 ml-auto">추가됨</span>
              )}
            </div>
          </div>
        </div>
      </li>
    );
  };

  const treeRow = (
    key: string,
    label: string,
    count: number,
    depth: number,
    nodeQuestions: QuestionRow[],
    children: React.ReactNode
  ) => {
    const colors = [
      "text-gray-800 font-semibold hover:bg-gray-50",
      "text-blue-700 font-medium hover:bg-blue-50",
      "text-amber-700 hover:bg-amber-50",
      "text-emerald-700 hover:bg-emerald-50",
      "text-purple-700 hover:bg-purple-50",
    ];
    const isOpen = expanded.has(key);
    const addable = nodeQuestions.filter(
      (q) => !selectedItems.some((it) => it.questionId === q.id)
    ).length;
    return (
      <div key={key} className={depth > 0 ? "border-t border-gray-50" : "border-b border-gray-100 last:border-b-0"}>
        <div className={`w-full flex items-center gap-2 pr-2 text-sm ${colors[depth] || colors[4]}`}>
          <button
            onClick={() => toggle(key)}
            className="flex-1 flex items-center gap-2 px-3 py-1.5 text-left"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            <span className="text-gray-400 text-xs w-4">{isOpen ? "▼" : "▶"}</span>
            <span>{label}</span>
            <span className="text-xs text-gray-400 ml-auto">{count}문제</span>
          </button>
          {addable > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addQuestions(nodeQuestions);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap px-2 py-0.5 rounded hover:bg-blue-50"
            >
              + 전체 {addable}
            </button>
          )}
        </div>
        {isOpen && children}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/exams/${id}/preview`} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; 미리보기로
        </Link>
        <h2 className="text-lg font-semibold text-gray-800">시험지 편집</h2>
      </div>

      {/* 시험지 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">시험지 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">시험지 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">시험 유형</label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value as ExamType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(EXAM_TYPE_MAP).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">학교명</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">학년</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">시험 시간 (분)</label>
            <input
              type="number"
              value={timeLimit || ""}
              onChange={(e) => setTimeLimit(Number(e.target.value) || undefined)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">시험일</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">안내사항</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 문제 은행 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-gray-800 mr-auto">
              문제 은행 ({filteredQuestions.length}개)
            </h3>
            <button
              onClick={() => setBulkModalOpen(true)}
              className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-medium px-3 py-1.5 rounded"
            >
              📚 교재별 일괄 추가
            </button>
            {checkedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{checkedIds.size}개 선택됨</span>
                <button
                  onClick={() => setCheckedIds(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  해제
                </button>
                <button
                  onClick={addCheckedQuestions}
                  className="text-xs bg-blue-600 text-white hover:bg-blue-700 font-medium px-3 py-1.5 rounded"
                >
                  + 선택한 문제 추가
                </button>
              </div>
            )}
          </div>

          {/* 정렬 토글 + 검색 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex bg-gray-100 rounded-lg p-1 text-xs">
              {(
                [
                  ["tree", "트리"],
                  ["date", "날짜순"],
                  ["grade", "학년순"],
                  ["textbook", "교과서순"],
                ] as [SortMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`px-2.5 py-1 rounded ${
                    sortMode === mode ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="발문/지문 검색"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
            />
          </div>

          <div className="max-h-[500px] overflow-y-auto border border-gray-100 rounded-lg">
            {sortMode === "tree" ? (
              (() => {
                const { tree, orphans } = buildTree();
                return (
                  <>
                    {Array.from(tree.entries()).map(([gKey, l2]) =>
                      treeRow(`g::${gKey}`, gKey, countTree(l2), 0, collectQuestions(l2),
                        <>{Array.from(l2.entries()).map(([tb, l3]) =>
                          treeRow(`t::${gKey}::${tb}`, tb, countTree(l3), 1, collectQuestions(l3),
                            <>{Array.from(l3.entries()).map(([ls, l4]) =>
                              treeRow(`l::${gKey}::${tb}::${ls}`, ls, countTree(l4), 2, collectQuestions(l4),
                                <>{Array.from(l4.entries()).map(([p, l5]) =>
                                  treeRow(`p::${gKey}::${tb}::${ls}::${p}`, p, countTree(l5), 3, collectQuestions(l5),
                                    <>{Array.from(l5.entries()).map(([qt, qs]) =>
                                      treeRow(`q::${gKey}::${tb}::${ls}::${p}::${qt}`, qt, qs.length, 4, qs,
                                        <ul className="space-y-1.5 py-2 px-2" style={{ paddingLeft: `${12 + 5 * 16}px` }}>
                                          {qs.map(renderQuestion)}
                                        </ul>
                                      )
                                    )}</>
                                  )
                                )}</>
                              )
                            )}</>
                          )
                        )}</>
                      )
                    )}
                    {orphans.length > 0 &&
                      treeRow("__orphans__", "지문 미연결", orphans.length, 0, orphans,
                        <ul className="space-y-1.5 py-2 px-4">{orphans.map(renderQuestion)}</ul>
                      )}
                  </>
                );
              })()
            ) : (
              flatGroups().map((g) =>
                treeRow(g.key, g.label, g.items.length, 0, g.items,
                  <ul className="space-y-1.5 py-2 px-4">{g.items.map(renderQuestion)}</ul>
                )
              )
            )}
          </div>
        </div>

        {/* 시험지 구성 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">
              시험지 구성 ({selectedItems.length}문항)
            </h3>
            <span className="text-sm font-medium text-blue-600">총 {calculatedTotal}점</span>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">왼쪽에서 문제를 추가하세요</p>
          ) : (
            <ul className="space-y-2 max-h-[600px] overflow-y-auto">
              {selectedItems.map((item, index) => (
                <li key={item.questionId} className="p-3 rounded-lg border border-gray-200 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{item.orderNum}번</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveItem(index, "up")}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(index, "down")}
                        disabled={index === selectedItems.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => removeQuestion(item.questionId)}
                        className="text-red-400 hover:text-red-600 px-1 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-1 truncate">{item.question.question}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.push(`/exams/${id}/preview`)}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>

      {bulkModalOpen && (() => {
        const tree = bulkBuildByTextbook();
        const alreadyIn = new Set(selectedItems.map((i) => i.questionId));
        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setBulkModalOpen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">교재별 일괄 추가</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    교재 → 단원 → 지문 순으로 펼쳐서 체크. 이미 추가된 문제는 자동으로 건너뜁니다.
                  </p>
                </div>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {Array.from(tree.entries()).map(([tb, lessons]) => {
                  const tbAllIds: string[] = [];
                  for (const ps of lessons.values()) for (const arr of ps.values()) for (const q of arr) if (!alreadyIn.has(q.id)) tbAllIds.push(q.id);
                  const tbAllChecked = tbAllIds.length > 0 && tbAllIds.every((id) => bulkCheckedIds.has(id));
                  const tbKey = `tb::${tb}`;
                  const tbOpen = bulkExpanded.has(tbKey);
                  return (
                    <div key={tbKey} className="mb-2 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-t-lg">
                        <input
                          type="checkbox"
                          checked={tbAllChecked}
                          disabled={tbAllIds.length === 0}
                          onChange={() => bulkToggle(tbAllIds)}
                        />
                        <button
                          onClick={() => bulkToggleExpanded(tbKey)}
                          className="flex-1 flex items-center gap-2 text-left text-sm font-semibold text-emerald-800"
                        >
                          <span className="text-xs">{tbOpen ? "▼" : "▶"}</span>
                          <span>{tb}</span>
                          <span className="text-xs text-emerald-600 ml-auto">
                            추가 가능 {tbAllIds.length}개
                          </span>
                        </button>
                      </div>
                      {tbOpen && (
                        <div className="px-3 py-2 space-y-1">
                          {Array.from(lessons.entries()).map(([ls, passages]) => {
                            const lsAllIds: string[] = [];
                            for (const arr of passages.values()) for (const q of arr) if (!alreadyIn.has(q.id)) lsAllIds.push(q.id);
                            const lsAllChecked = lsAllIds.length > 0 && lsAllIds.every((id) => bulkCheckedIds.has(id));
                            const lsKey = `ls::${tb}::${ls}`;
                            const lsOpen = bulkExpanded.has(lsKey);
                            return (
                              <div key={lsKey} className="border-l-2 border-emerald-100 pl-2">
                                <div className="flex items-center gap-2 py-1">
                                  <input
                                    type="checkbox"
                                    checked={lsAllChecked}
                                    disabled={lsAllIds.length === 0}
                                    onChange={() => bulkToggle(lsAllIds)}
                                  />
                                  <button
                                    onClick={() => bulkToggleExpanded(lsKey)}
                                    className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-amber-700"
                                  >
                                    <span className="text-xs">{lsOpen ? "▼" : "▶"}</span>
                                    <span>{ls}</span>
                                    <span className="text-xs text-gray-400 ml-auto">
                                      {lsAllIds.length}개
                                    </span>
                                  </button>
                                </div>
                                {lsOpen && (
                                  <div className="pl-4 py-1 space-y-1">
                                    {Array.from(passages.entries()).map(([pTitle, qs]) => {
                                      const pAllIds = qs.filter((q) => !alreadyIn.has(q.id)).map((q) => q.id);
                                      const pAllChecked = pAllIds.length > 0 && pAllIds.every((id) => bulkCheckedIds.has(id));
                                      const pKey = `p::${tb}::${ls}::${pTitle}`;
                                      const pOpen = bulkExpanded.has(pKey);
                                      return (
                                        <div key={pKey} className="border-l border-amber-100 pl-2">
                                          <div className="flex items-center gap-2 py-1">
                                            <input
                                              type="checkbox"
                                              checked={pAllChecked}
                                              disabled={pAllIds.length === 0}
                                              onChange={() => bulkToggle(pAllIds)}
                                            />
                                            <button
                                              onClick={() => bulkToggleExpanded(pKey)}
                                              className="flex-1 flex items-center gap-2 text-left text-xs text-gray-700"
                                            >
                                              <span className="text-xs">{pOpen ? "▼" : "▶"}</span>
                                              <span className="truncate">{pTitle}</span>
                                              <span className="text-xs text-gray-400 ml-auto">
                                                {pAllIds.length}/{qs.length}
                                              </span>
                                            </button>
                                          </div>
                                          {pOpen && (
                                            <ul className="pl-5 py-1 space-y-0.5">
                                              {qs.map((q) => {
                                                const isIn = alreadyIn.has(q.id);
                                                const ti = getQuestionTypeInfo(q.examType, q.questionType);
                                                const typeLabel = ti ? `${ti.number}번 ${ti.name}` : q.questionType;
                                                return (
                                                  <li key={q.id} className="flex items-center gap-2 text-xs py-0.5">
                                                    <input
                                                      type="checkbox"
                                                      checked={bulkCheckedIds.has(q.id)}
                                                      disabled={isIn}
                                                      onChange={() => bulkToggle([q.id])}
                                                    />
                                                    <span className={`flex-1 truncate ${isIn ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                                      <span className="text-purple-600 mr-1">[{typeLabel}]</span>
                                                      {q.question}
                                                    </span>
                                                    {isIn && <span className="text-xs text-gray-400">추가됨</span>}
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {tree.size === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">표시할 문제가 없습니다.</p>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <span className="text-sm text-gray-600">
                  {bulkCheckedIds.size}개 선택됨
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkCheckedIds(new Set())}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    선택 해제
                  </button>
                  <button
                    onClick={addBulkChecked}
                    disabled={bulkCheckedIds.size === 0}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    + 선택한 {bulkCheckedIds.size}개 추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {detailQuestion && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailQuestion(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">문제 상세보기</h3>
              <button
                onClick={() => setDetailQuestion(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">발문</p>
              <p className="text-sm text-gray-800">{detailQuestion.question}</p>
            </div>
            {detailQuestion.passage && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">지문</p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-gray-700">
                    {detailQuestion.passage}
                  </p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">선지</p>
              <div className="space-y-1">
                {(() => {
                  try {
                    const choices: Choice[] = JSON.parse(detailQuestion.choices);
                    return choices.map((c, i) => (
                      <p
                        key={i}
                        className={`text-sm py-1 px-2 rounded ${
                          c.isCorrect ? "bg-green-50 text-green-700 font-semibold" : "text-gray-700"
                        }`}
                      >
                        {c.label} {c.text}
                        {c.isCorrect && " (정답)"}
                      </p>
                    ));
                  } catch {
                    return <p className="text-sm text-gray-400">선지 파싱 오류</p>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
