"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EXAM_TYPE_MAP, getQuestionTypeInfo } from "@/lib/question-types";
import type { ExamType, Choice } from "@/types";

interface QuestionRow {
  id: string;
  examType: string;
  questionType: string;
  question: string;
  difficulty: string;
  points: number;
}

interface SelectedItem {
  questionId: string;
  question: QuestionRow;
  orderNum: number;
  customPoints?: number;
}

export default function NewExamPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // 시험지 정보
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<ExamType>("suneung");
  const [totalPoints, setTotalPoints] = useState(100);
  const [timeLimit, setTimeLimit] = useState<number | undefined>(70);
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [instructions, setInstructions] = useState(
    "문항에 따라 배점이 다릅니다. 3점 문항에는 점수가 표시되어 있습니다. 점수 표시가 없는 문항은 모두 2점입니다."
  );

  // 문제 선택
  const [availableQuestions, setAvailableQuestions] = useState<QuestionRow[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    fetch("/api/questions")
      .then((res) => res.json())
      .then((data) => {
        setAvailableQuestions(data);
        setLoadingQuestions(false);
      });
  }, []);

  function addQuestion(q: QuestionRow) {
    if (selectedItems.find((item) => item.questionId === q.id)) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        questionId: q.id,
        question: q,
        orderNum: prev.length + 1,
      },
    ]);
  }

  function removeQuestion(questionId: string) {
    setSelectedItems((prev) =>
      prev
        .filter((item) => item.questionId !== questionId)
        .map((item, i) => ({ ...item, orderNum: i + 1 }))
    );
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...selectedItems];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newItems.length) return;
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
    setSelectedItems(
      newItems.map((item, i) => ({ ...item, orderNum: i + 1 }))
    );
  }

  const calculatedTotal = selectedItems.reduce(
    (sum, item) => sum + (item.customPoints || item.question.points),
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
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          examType,
          totalPoints: calculatedTotal,
          timeLimit,
          headerInfo: { school, grade, date: new Date().toISOString().split("T")[0] },
          instructions,
          items: selectedItems.map((item) => ({
            questionId: item.questionId,
            orderNum: item.orderNum,
            customPoints: item.customPoints,
          })),
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      const exam = await res.json();
      router.push(`/exams/${exam.id}/preview`);
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
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
              placeholder="예: 2학기 중간고사 영어"
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
                <option key={key} value={key}>{val.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">학교명</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="예: OO고등학교"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">학년</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="예: 고2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">시험 시간 (분)</label>
            <input
              type="number"
              value={timeLimit || ""}
              onChange={(e) => setTimeLimit(Number(e.target.value) || undefined)}
              placeholder="70"
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
        {/* 문제 은행 (왼쪽) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            문제 은행 ({availableQuestions.length}개)
          </h3>
          {loadingQuestions ? (
            <p className="text-sm text-gray-400">불러오는 중...</p>
          ) : availableQuestions.length === 0 ? (
            <p className="text-sm text-gray-400">
              등록된 문제가 없습니다. 먼저 문제를 만들어주세요.
            </p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {availableQuestions.map((q) => {
                const isSelected = selectedItems.some(
                  (item) => item.questionId === q.id
                );
                const typeInfo = getQuestionTypeInfo(q.examType, q.questionType);
                return (
                  <li
                    key={q.id}
                    className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 opacity-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                    onClick={() => !isSelected && addQuestion(q)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {typeInfo
                          ? `${typeInfo.number}번 ${typeInfo.name}`
                          : q.questionType}
                      </span>
                      <span className="text-xs text-gray-400">{q.points}점</span>
                    </div>
                    <p className="text-gray-700 mt-1 truncate">
                      {q.question}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 시험지 구성 (오른쪽) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">
              시험지 구성 ({selectedItems.length}문항)
            </h3>
            <span className="text-sm font-medium text-blue-600">
              총 {calculatedTotal}점
            </span>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              왼쪽에서 문제를 클릭하여 추가하세요
            </p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {selectedItems.map((item, index) => (
                <li
                  key={item.questionId}
                  className="p-3 rounded-lg border border-gray-200 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">
                      {item.orderNum}번
                    </span>
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
                  <p className="text-gray-600 mt-1 truncate">
                    {item.question.question}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 저장 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "시험지 저장 및 미리보기"}
        </button>
      </div>
    </div>
  );
}
