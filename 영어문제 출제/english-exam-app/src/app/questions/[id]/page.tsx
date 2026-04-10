"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { EXAM_TYPE_MAP, getQuestionTypes, DIFFICULTY_MAP } from "@/lib/question-types";
import type { Choice, ExamType, Difficulty } from "@/types";

const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];

export default function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [examType, setExamType] = useState<ExamType>("suneung");
  const [questionType, setQuestionType] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [passage, setPassage] = useState("");
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [explanation, setExplanation] = useState("");
  const [points, setPoints] = useState(2);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    fetch(`/api/questions/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setExamType(data.examType);
        setQuestionType(data.questionType);
        setDifficulty(data.difficulty);
        setPassage(data.passage);
        setQuestion(data.question);
        setChoices(JSON.parse(data.choices));
        setExplanation(data.explanation || "");
        setPoints(data.points);
        setAiGenerated(data.aiGenerated);
        setLoading(false);
      });
  }, [id]);

  const questionTypes = getQuestionTypes(examType);

  function updateChoice(index: number, text: string) {
    setChoices((prev) =>
      prev.map((c, i) => (i === index ? { ...c, text } : c))
    );
  }

  function setCorrectAnswer(index: number) {
    setChoices((prev) =>
      prev.map((c, i) => ({ ...c, isCorrect: i === index }))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const correctIndex = choices.findIndex((c) => c.isCorrect);
      await fetch(`/api/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          questionType,
          points,
          passage,
          question,
          choices,
          answer: choices[correctIndex]?.label || "",
          explanation,
          difficulty,
        }),
      });
      setEditing(false);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 상단 액션 바 */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; 돌아가기
        </button>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              편집
            </button>
          )}
        </div>
      </div>

      {/* 메타 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex gap-3 mb-4">
          <span className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600">
            {EXAM_TYPE_MAP[examType]?.name || examType}
          </span>
          <span
            className={`px-2 py-1 text-xs rounded ${DIFFICULTY_MAP[difficulty]?.color}`}
          >
            {DIFFICULTY_MAP[difficulty]?.name}
          </span>
          <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
            {points}점
          </span>
          <span
            className={`px-2 py-1 text-xs rounded ${
              aiGenerated
                ? "bg-purple-50 text-purple-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {aiGenerated ? "AI 생성" : "수동 작성"}
          </span>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(EXAM_TYPE_MAP).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.name}
                  </option>
                ))}
              </select>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {questionTypes.map((qt) => (
                  <option key={qt.code} value={qt.code}>
                    {qt.number}번 - {qt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>

      {/* 지문 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">지문</h3>
        {editing ? (
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-gray-800">
            {passage}
          </p>
        )}
      </div>

      {/* 발문 + 선지 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">발문</h3>
        {editing ? (
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
          />
        ) : (
          <p className="text-sm font-medium text-gray-800 mb-4">{question}</p>
        )}

        <div className="space-y-2">
          {choices.map((choice, i) => (
            <div key={i} className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setCorrectAnswer(i)}
                    className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${
                      choice.isCorrect
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {choice.label}
                  </button>
                  <input
                    type="text"
                    value={choice.text}
                    onChange={(e) => updateChoice(i, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </>
              ) : (
                <p
                  className={`text-sm py-1 ${
                    choice.isCorrect
                      ? "text-green-700 font-semibold"
                      : "text-gray-700"
                  }`}
                >
                  {choice.label} {choice.text}
                  {choice.isCorrect && " ✓"}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 해설 */}
      {(explanation || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">해설</h3>
          {editing ? (
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
