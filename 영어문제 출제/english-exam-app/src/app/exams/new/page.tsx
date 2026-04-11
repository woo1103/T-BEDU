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
  passage: string;
  choices: string;
  answer: string;
  explanation: string | null;
  difficulty: string;
  points: number;
  source: string | null;
  aiGenerated: boolean;
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
  const [detailQuestion, setDetailQuestion] = useState<QuestionRow | null>(null);

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
                const diffLabel = { easy: "하", medium: "중", hard: "상" }[q.difficulty] || q.difficulty;
                return (
                  <li
                    key={q.id}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 opacity-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {typeInfo
                            ? `${typeInfo.number}번 ${typeInfo.name}`
                            : q.questionType}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {diffLabel} · {q.points}점
                        </span>
                        {q.aiGenerated && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">AI</span>
                        )}
                      </div>
                    </div>
                    {q.source && q.source !== "직접 작성" && q.source !== "AI 생성 (Claude)" && (
                      <p className="text-xs text-amber-600 mb-1">{q.source}</p>
                    )}
                    <p className="text-gray-700 truncate">{q.question}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailQuestion(q); }}
                        className="text-xs text-gray-500 hover:text-blue-600 underline"
                      >
                        상세보기
                      </button>
                      {!isSelected && (
                        <button
                          onClick={() => addQuestion(q)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto"
                        >
                          + 추가
                        </button>
                      )}
                      {isSelected && (
                        <span className="text-xs text-gray-400 ml-auto">추가됨</span>
                      )}
                    </div>
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

      {/* 상세보기 모달 */}
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

            <div className="flex gap-2 flex-wrap">
              {(() => {
                const ti = getQuestionTypeInfo(detailQuestion.examType, detailQuestion.questionType);
                return (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {ti ? `${ti.number}번 ${ti.name}` : detailQuestion.questionType}
                  </span>
                );
              })()}
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {{ easy: "하", medium: "중", hard: "상" }[detailQuestion.difficulty] || detailQuestion.difficulty} · {detailQuestion.points}점
              </span>
              {detailQuestion.aiGenerated && (
                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">AI 생성</span>
              )}
              {detailQuestion.source && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">{detailQuestion.source}</span>
              )}
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
                          c.isCorrect
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "text-gray-700"
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

            {detailQuestion.explanation && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">해설</p>
                <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
                  {detailQuestion.explanation}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setDetailQuestion(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                닫기
              </button>
              {!selectedItems.some((item) => item.questionId === detailQuestion.id) && (
                <button
                  onClick={() => {
                    addQuestion(detailQuestion);
                    setDetailQuestion(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  시험지에 추가
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
