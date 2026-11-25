"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EXAM_TYPE_MAP } from "@/lib/question-types";
import ExamComposer from "@/components/exams/ExamComposer";
import type { ExamType } from "@/types";

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
  setId?: string | null;
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
  usage?: { assignments: number; classes: string[]; submissions: number };
}

interface SelectedItem {
  questionId: string;
  question: QuestionRow;
  orderNum: number;
  customPoints?: number | null;
}

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

  // 이미 학생이 푼 시험지면 덮어쓰지 않고 복제본으로 저장하게 안내
  const [usage, setUsage] = useState<ExamDetail["usage"]>(undefined);

  useEffect(() => {
    Promise.all([
      fetch(`/api/exams/${id}`).then((r) => r.json()),
      // 문제 은행을 못 불러와도 시험지 편집은 열리게(빈 은행)
      fetch(`/api/questions`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([exam, qs]: [ExamDetail, QuestionRow[]]) => {
      setTitle(exam.title);
      setUsage(exam.usage);
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
      setAvailableQuestions(Array.isArray(qs) ? qs : []);
      setLoading(false);
    });
  }, [id]);

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
    const body = {
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
    };
    // 푼 학생이 있는 시험지: 문항이 바뀌면 기존 제출의 번호·점수가 어긋나므로 복제본으로 저장
    const submitted = usage?.submissions ?? 0;
    const asCopy =
      submitted > 0 &&
      confirm(
        `이 시험지는 이미 학생 ${submitted}명이 풀었어요.
원본을 그대로 두고 수정한 내용을 새 시험지(복제본)로 저장할까요?

[확인] 복제본으로 저장(권장)   [취소] 그냥 원본을 덮어쓰기`
      );
    setSaving(true);
    try {
      const res = await fetch(asCopy ? "/api/exams" : `/api/exams/${id}`, {
        method: asCopy ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asCopy ? { ...body, title: title.includes("(수정본)") ? title : `${title} (수정본)` } : body),
      });
      if (!res.ok) throw new Error("저장 실패");
      const saved = asCopy ? ((await res.json()) as { id: string }) : { id };
      router.push(`/exams/${saved.id}/preview`);
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/exams/${id}/preview`} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; 미리보기로
        </Link>
        <h2 className="text-lg font-semibold text-gray-800">시험지 편집</h2>
      </div>
      {usage && usage.submissions > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
          이미 학생 <b>{usage.submissions}명</b>이 푼 시험지예요
          {usage.classes.length > 0 && <> ({usage.classes.join(", ")})</>}. 문항을 바꾸면 기존 점수 기록과 번호가 어긋나니,
          저장할 때 <b>복제본으로 저장</b>을 권해요. 제목·안내문만 고치는 거라면 덮어써도 괜찮아요.
        </div>
      )}

      {/* 시험지 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">시험지 정보</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* 문제 고르기: 왼쪽 문제 카드 · 오른쪽 시험지 미리보기 */}
      <ExamComposer
        questions={availableQuestions}
        items={selectedItems}
        onItemsChange={setSelectedItems}
        onQuestionUpdated={(q) => setAvailableQuestions((list) => list.map((x) => (x.id === q.id ? q : x)))}
        header={{ title, school, grade }}
      />

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

    </div>
  );
}
