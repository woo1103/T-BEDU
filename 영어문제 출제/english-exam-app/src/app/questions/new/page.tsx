"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EXAM_TYPE_MAP, getQuestionTypes, DIFFICULTY_MAP } from "@/lib/question-types";
import type { Choice, ExamType, Difficulty, PassageMode } from "@/types";

interface SavedPassage {
  id: string;
  textbook: string;
  grade: string;
  lesson: string;
  title: string | null;
  content: string;
  wordCount: number;
}

const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];

interface GeneratedQuestion {
  passage: string;
  question: string;
  choices: Choice[];
  explanation: string;
  points: number;
  questionType: string;
  questionTypeName: string;
}

interface TypeSelection {
  code: string;
  name: string;
  count: number;
}

export default function NewQuestionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 공통 필드
  const [examType, setExamType] = useState<ExamType>("suneung");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  // AI - 복수 유형 선택
  const [selectedTypes, setSelectedTypes] = useState<TypeSelection[]>([]);
  const [topic, setTopic] = useState("");
  const [sourcePassage, setSourcePassage] = useState("");
  const [passageMode, setPassageMode] = useState<PassageMode>("original");

  // 저장된 지문
  const [savedPassages, setSavedPassages] = useState<SavedPassage[]>([]);
  const [passageInputMode, setPassageInputMode] = useState<"saved" | "direct">("saved");
  const [selectedPassageIds, setSelectedPassageIds] = useState<Set<string>>(new Set());

  // 트리 펼침 상태
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedTextbooks, setExpandedTextbooks] = useState<Set<string>>(new Set());

  // AI 생성 결과
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentPreview, setCurrentPreview] = useState(0);

  // 수동 입력 필드
  const [manualQuestionType, setManualQuestionType] = useState("");
  const [passage, setPassage] = useState("");
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<Choice[]>(
    CIRCLE_LABELS.map((label) => ({ label, text: "", isCorrect: false }))
  );
  const [explanation, setExplanation] = useState("");
  const [points, setPoints] = useState(2);

  const questionTypes = getQuestionTypes(examType);

  // 내신 모드일 때 저장된 지문 불러오기
  useEffect(() => {
    if (examType === "naesin") {
      fetch("/api/passages")
        .then((res) => res.json())
        .then((data) => setSavedPassages(data));
    }
  }, [examType]);

  // 지문을 학년 → 교과서 → 단원 트리로 그룹핑
  type PassageTree = Map<string, Map<string, SavedPassage[]>>;
  function buildPassageTree(): PassageTree {
    const tree: PassageTree = new Map();
    for (const p of savedPassages) {
      if (!tree.has(p.grade)) tree.set(p.grade, new Map());
      const textbookMap = tree.get(p.grade)!;
      if (!textbookMap.has(p.textbook)) textbookMap.set(p.textbook, []);
      textbookMap.get(p.textbook)!.push(p);
    }
    return tree;
  }

  const passageTree = buildPassageTree();

  // 개별 지문 토글
  function togglePassageSelection(passageId: string) {
    setSelectedPassageIds((prev) => {
      const next = new Set(prev);
      if (next.has(passageId)) next.delete(passageId);
      else next.add(passageId);
      return next;
    });
  }

  // 교과서 단위 일괄 선택/해제
  function toggleTextbookAll(grade: string, textbook: string) {
    const passages = passageTree.get(grade)?.get(textbook) || [];
    const ids = passages.map((p) => p.id);
    const allSelected = ids.every((id) => selectedPassageIds.has(id));
    setSelectedPassageIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // 학년 단위 일괄 선택/해제
  function toggleGradeAll(grade: string) {
    const textbookMap = passageTree.get(grade);
    if (!textbookMap) return;
    const ids: string[] = [];
    textbookMap.forEach((passages) => passages.forEach((p) => ids.push(p.id)));
    const allSelected = ids.every((id) => selectedPassageIds.has(id));
    setSelectedPassageIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // 트리 펼침 토글
  function toggleGradeExpand(grade: string) {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  function toggleTextbookExpand(key: string) {
    setExpandedTextbooks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 체크 상태 계산
  function getGradeCheckState(grade: string): "all" | "some" | "none" {
    const textbookMap = passageTree.get(grade);
    if (!textbookMap) return "none";
    const ids: string[] = [];
    textbookMap.forEach((passages) => passages.forEach((p) => ids.push(p.id)));
    const selectedCount = ids.filter((id) => selectedPassageIds.has(id)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === ids.length) return "all";
    return "some";
  }

  function getTextbookCheckState(grade: string, textbook: string): "all" | "some" | "none" {
    const passages = passageTree.get(grade)?.get(textbook) || [];
    const selectedCount = passages.filter((p) => selectedPassageIds.has(p.id)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === passages.length) return "all";
    return "some";
  }

  // 유형 토글
  function toggleType(code: string, name: string) {
    setSelectedTypes((prev) => {
      const exists = prev.find((t) => t.code === code);
      if (exists) return prev.filter((t) => t.code !== code);
      return [...prev, { code, name, count: 1 }];
    });
  }

  function updateTypeCount(code: string, count: number) {
    setSelectedTypes((prev) =>
      prev.map((t) => (t.code === code ? { ...t, count: Math.max(1, count) } : t))
    );
  }

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

  // 선택된 지문 목록 (저장된 지문 모드일 때)
  function getSelectedPassages(): SavedPassage[] {
    if (passageInputMode === "direct") return [];
    return savedPassages.filter((p) => selectedPassageIds.has(p.id));
  }

  // 총 생성 문제 수 = 유형별 개수 × 지문 수 (지문 선택 시)
  const selectedPassageCount = passageInputMode === "saved" ? selectedPassageIds.size : (sourcePassage.trim() ? 1 : 0);
  const passageMultiplier = selectedPassageCount > 0 ? selectedPassageCount : 1;

  // AI 복수 생성
  async function handleGenerate() {
    if (selectedTypes.length === 0) {
      alert("최소 1개 이상의 문제 유형을 선택해주세요.");
      return;
    }
    setGenerating(true);
    setGeneratedQuestions([]);

    const results: GeneratedQuestion[] = [];

    // 지문 목록 준비: 저장된 지문이 선택되었으면 각각, 아니면 빈/직접입력 1개
    const passagesToUse: { content: string; label: string }[] = [];
    const selectedSaved = getSelectedPassages();
    if (selectedSaved.length > 0) {
      for (const p of selectedSaved) {
        passagesToUse.push({
          content: p.content,
          label: `${p.textbook} ${p.lesson}${p.title ? ` - ${p.title}` : ""}`,
        });
      }
    } else if (passageInputMode === "direct" && sourcePassage.trim()) {
      passagesToUse.push({ content: sourcePassage, label: "직접 입력 지문" });
    } else {
      passagesToUse.push({ content: "", label: "" });
    }

    for (const passageItem of passagesToUse) {
      for (const typeSelection of selectedTypes) {
        for (let i = 0; i < typeSelection.count; i++) {
          try {
            const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                examType,
                questionType: typeSelection.code,
                difficulty,
                topic,
                sourcePassage: passageItem.content || undefined,
                passageMode: passageItem.content ? passageMode : undefined,
              }),
            });
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "생성 실패");
            }
            const data = await res.json();
            results.push({
              passage: data.passage || "",
              question: data.question || "",
              choices: (data.choices || []).map(
                (c: { text: string; isCorrect: boolean }, idx: number) => ({
                  label: CIRCLE_LABELS[idx] || `(${idx + 1})`,
                  text: c.text,
                  isCorrect: c.isCorrect,
                })
              ),
              explanation: data.explanation || "",
              points: data.points || 2,
              questionType: typeSelection.code,
              questionTypeName: typeSelection.name,
            });
            setGeneratedQuestions([...results]);
          } catch (err) {
            alert(
              `${passageItem.label ? `[${passageItem.label}] ` : ""}${typeSelection.name} ${i + 1}번째 생성 실패: ${
                err instanceof Error ? err.message : "오류"
              }`
            );
          }
        }
      }
    }

    setGeneratedQuestions(results);
    setCurrentPreview(0);
    setGenerating(false);
  }

  // 개별 문제 저장
  async function saveQuestion(q: GeneratedQuestion) {
    const correctIndex = q.choices.findIndex((c) => c.isCorrect);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examType,
        questionType: q.questionType,
        points: q.points,
        passage: q.passage,
        question: q.question,
        choices: q.choices,
        answer: q.choices[correctIndex]?.label || "",
        explanation: q.explanation,
        difficulty,
        aiGenerated: true,
        source: "AI 생성 (Claude)",
      }),
    });
    return res.ok;
  }

  // 전체 저장
  async function handleSaveAll() {
    setSaving(true);
    let successCount = 0;
    for (const q of generatedQuestions) {
      const ok = await saveQuestion(q);
      if (ok) successCount++;
    }
    setSaving(false);
    alert(`${successCount}개의 문제가 저장되었습니다.`);
    router.push("/questions");
  }

  // 수동 저장
  async function handleManualSave() {
    if (!passage.trim() || !question.trim()) {
      alert("지문과 발문은 필수입니다.");
      return;
    }
    const correctIndex = choices.findIndex((c) => c.isCorrect);
    if (correctIndex === -1) {
      alert("정답을 선택해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          questionType: manualQuestionType || "custom",
          points,
          passage,
          question,
          choices,
          answer: choices[correctIndex].label,
          explanation,
          difficulty,
          aiGenerated: false,
          source: "직접 작성",
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.push("/questions");
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // 생성된 문제 편집
  function updateGenerated(index: number, field: string, value: string) {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function updateGeneratedChoice(qIndex: number, cIndex: number, text: string) {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              choices: q.choices.map((c, ci) =>
                ci === cIndex ? { ...c, text } : c
              ),
            }
          : q
      )
    );
  }

  function setGeneratedCorrect(qIndex: number, cIndex: number) {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              choices: q.choices.map((c, ci) => ({
                ...c,
                isCorrect: ci === cIndex,
              })),
            }
          : q
      )
    );
  }

  const typesTotal = selectedTypes.reduce((sum, t) => sum + t.count, 0);
  const totalToGenerate = typesTotal * passageMultiplier;
  const currentQ = generatedQuestions[currentPreview];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 모드 선택 */}
      <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          수동 입력
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
            mode === "ai"
              ? "bg-purple-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          AI 자동 생성
        </button>
      </div>

      {/* 시험 유형 + 난이도 (공통) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">기본 설정</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">시험 유형</label>
            <select
              value={examType}
              onChange={(e) => {
                setExamType(e.target.value as ExamType);
                setSelectedTypes([]);
                setManualQuestionType("");
              }}
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
            <label className="block text-sm text-gray-600 mb-1">난이도</label>
            <div className="flex gap-2">
              {(
                Object.entries(DIFFICULTY_MAP) as [
                  Difficulty,
                  { name: string; color: string },
                ][]
              ).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    difficulty === key
                      ? val.color + " ring-2 ring-offset-1 ring-current"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {val.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========== AI 모드 ========== */}
      {mode === "ai" && (
        <>
          {/* 내신 지문 학습 */}
          {examType === "naesin" && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-amber-800 text-lg">
                  지문 선택 (내신 출제용)
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  저장된 교과서 지문을 선택하거나 직접 입력하여 문제를 출제합니다.
                  선택하지 않으면 AI가 새로운 지문을 자체 생성합니다.
                </p>
              </div>

              {/* 입력 방식 탭 */}
              <div className="flex gap-1 bg-amber-100 rounded-lg p-1">
                <button
                  onClick={() => setPassageInputMode("saved")}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    passageInputMode === "saved"
                      ? "bg-white text-amber-800 shadow-sm"
                      : "text-amber-600 hover:text-amber-800"
                  }`}
                >
                  저장된 지문 선택 ({savedPassages.length})
                </button>
                <button
                  onClick={() => setPassageInputMode("direct")}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    passageInputMode === "direct"
                      ? "bg-white text-amber-800 shadow-sm"
                      : "text-amber-600 hover:text-amber-800"
                  }`}
                >
                  직접 입력
                </button>
              </div>

              {/* 저장된 지문 선택 모드 - 트리 구조 */}
              {passageInputMode === "saved" && (
                <div className="space-y-3">
                  {savedPassages.length === 0 ? (
                    <div className="text-center py-6 text-amber-600 text-sm">
                      <p>저장된 지문이 없습니다.</p>
                      <a
                        href="/passages/new"
                        className="text-amber-800 underline font-medium"
                      >
                        지문 등록하기
                      </a>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-y-auto pr-1 bg-white rounded-lg border border-amber-200">
                        {Array.from(passageTree.entries()).map(([grade, textbookMap]) => {
                          const gradeCheck = getGradeCheckState(grade);
                          const gradeExpanded = expandedGrades.has(grade);
                          return (
                            <div key={grade} className="border-b border-gray-100 last:border-b-0">
                              {/* 학년 레벨 */}
                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50">
                                <button
                                  onClick={() => toggleGradeExpand(grade)}
                                  className="text-gray-400 text-xs w-4"
                                >
                                  {gradeExpanded ? "▼" : "▶"}
                                </button>
                                <input
                                  type="checkbox"
                                  checked={gradeCheck === "all"}
                                  ref={(el) => { if (el) el.indeterminate = gradeCheck === "some"; }}
                                  onChange={() => toggleGradeAll(grade)}
                                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-sm font-semibold text-gray-800">{grade}</span>
                                <span className="text-xs text-gray-400 ml-auto">
                                  {(() => {
                                    let count = 0;
                                    textbookMap.forEach((ps) => { count += ps.length; });
                                    return `${count}개 지문`;
                                  })()}
                                </span>
                              </div>

                              {/* 교과서 레벨 */}
                              {gradeExpanded && (
                                <div className="pl-6">
                                  {Array.from(textbookMap.entries()).map(([textbook, passages]) => {
                                    const tbKey = `${grade}::${textbook}`;
                                    const tbCheck = getTextbookCheckState(grade, textbook);
                                    const tbExpanded = expandedTextbooks.has(tbKey);
                                    return (
                                      <div key={tbKey} className="border-t border-gray-50">
                                        {/* 교과서 행 */}
                                        <div className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50">
                                          <button
                                            onClick={() => toggleTextbookExpand(tbKey)}
                                            className="text-gray-400 text-xs w-4"
                                          >
                                            {tbExpanded ? "▼" : "▶"}
                                          </button>
                                          <input
                                            type="checkbox"
                                            checked={tbCheck === "all"}
                                            ref={(el) => { if (el) el.indeterminate = tbCheck === "some"; }}
                                            onChange={() => toggleTextbookAll(grade, textbook)}
                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                          />
                                          <span className="text-sm font-medium text-blue-700">{textbook}</span>
                                          <span className="text-xs text-gray-400 ml-auto">{passages.length}개</span>
                                        </div>

                                        {/* 단원(지문) 레벨 */}
                                        {tbExpanded && (
                                          <div className="pl-6">
                                            {passages.map((p) => {
                                              const isSelected = selectedPassageIds.has(p.id);
                                              return (
                                                <label
                                                  key={p.id}
                                                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-t border-gray-50 transition-colors ${
                                                    isSelected ? "bg-amber-50" : "hover:bg-gray-50"
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => togglePassageSelection(p.id)}
                                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                                  />
                                                  <span className="text-sm text-gray-700 flex-1">
                                                    {p.lesson}
                                                    {p.title && <span className="text-gray-400"> - {p.title}</span>}
                                                  </span>
                                                  <span className="text-xs text-gray-400">{p.wordCount}단어</span>
                                                </label>
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
                      </div>
                      {selectedPassageIds.size > 0 && (
                        <div className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-amber-200">
                          <div className="flex items-center gap-2 text-amber-700">
                            <span className="inline-block w-2 h-2 bg-amber-500 rounded-full"></span>
                            {selectedPassageIds.size}개 지문 선택됨
                          </div>
                          <button
                            onClick={() => setSelectedPassageIds(new Set())}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            선택 해제
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 직접 입력 모드 */}
              {passageInputMode === "direct" && (
                <textarea
                  value={sourcePassage}
                  onChange={(e) => setSourcePassage(e.target.value)}
                  rows={10}
                  placeholder={"교과서 영어 지문을 여기에 붙여넣기 하세요...\n\n예시:\nThe concept of emotional intelligence has gained significant attention in recent decades..."}
                  className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                />
              )}

              {/* 지문 활용 방식 (지문이 선택/입력된 경우) */}
              {(selectedPassageIds.size > 0 || (passageInputMode === "direct" && sourcePassage.trim())) && (
                <div className="bg-white rounded-lg border border-amber-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">
                    지문 활용 방식
                  </p>
                  <div className="flex gap-3">
                    <label
                      className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                        passageMode === "original"
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-200 bg-white hover:border-amber-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="passageMode"
                        value="original"
                        checked={passageMode === "original"}
                        onChange={() => setPassageMode("original")}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-gray-800">
                        원문 그대로
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        교과서 지문을 그대로 사용하여 문제 출제
                      </span>
                    </label>
                    <label
                      className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                        passageMode === "modified"
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-200 bg-white hover:border-amber-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="passageMode"
                        value="modified"
                        checked={passageMode === "modified"}
                        onChange={() => setPassageMode("modified")}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-gray-800">
                        변형 출제
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        어휘/구문/내용을 난이도에 맞게 변형
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-amber-600">
                    {passageMode === "original"
                      ? "원본 지문이 그대로 출제되며, 선지와 발문만 새로 생성됩니다."
                      : "난이도에 따라 지문이 변형됩니다. 중 난이도는 일부 표현 교체, 상 난이도는 단어/내용 전면 변형."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 복수 유형 선택 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">
              문제 유형 선택 (복수 선택 가능)
            </h3>

            {/* 유형별 카테고리 그룹 */}
            {(() => {
              const categories = new Map<string, typeof questionTypes>();
              questionTypes.forEach((qt) => {
                if (!categories.has(qt.category)) {
                  categories.set(qt.category, []);
                }
                categories.get(qt.category)!.push(qt);
              });

              return Array.from(categories.entries()).map(([cat, types]) => (
                <div key={cat}>
                  <p className="text-xs text-gray-500 font-medium mb-2">{cat}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {types.map((qt) => {
                      const isSelected = selectedTypes.some(
                        (t) => t.code === qt.code
                      );
                      return (
                        <button
                          key={qt.code}
                          onClick={() => toggleType(qt.code, qt.name)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {qt.number}번 {qt.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}

            {/* 선택된 유형별 개수 */}
            {selectedTypes.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  선택된 유형 ({selectedTypes.length}개, 유형당 {typesTotal}문제
                  {passageMultiplier > 1 && ` × ${passageMultiplier}지문 = ${totalToGenerate}문제`}
                  {passageMultiplier <= 1 && `, 총 ${totalToGenerate}문제`})
                </p>
                <div className="space-y-2">
                  {selectedTypes.map((st) => (
                    <div
                      key={st.code}
                      className="flex items-center gap-3 bg-purple-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-purple-800 flex-1">
                        {st.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateTypeCount(st.code, st.count - 1)
                          }
                          className="w-6 h-6 rounded bg-purple-200 text-purple-700 text-sm flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-6 text-center">
                          {st.count}
                        </span>
                        <button
                          onClick={() =>
                            updateTypeCount(st.code, st.count + 1)
                          }
                          className="w-6 h-6 rounded bg-purple-200 text-purple-700 text-sm flex items-center justify-center"
                        >
                          +
                        </button>
                        <span className="text-xs text-purple-600">개</span>
                      </div>
                      <button
                        onClick={() => toggleType(st.code, st.name)}
                        className="text-red-400 hover:text-red-600 text-sm ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 주제 + 생성 버튼 */}
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6 space-y-4">
            <div>
              <label className="block text-sm text-purple-700 mb-1">
                주제/키워드 (선택)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 환경, 기술, 교육, 심리학..."
                className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || selectedTypes.length === 0}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {generating
                ? `생성 중... (${generatedQuestions.length}/${totalToGenerate})`
                : `${totalToGenerate}개 문제 AI 생성하기`}
            </button>
          </div>

          {/* 생성 결과 미리보기 */}
          {generatedQuestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  생성 결과 ({generatedQuestions.length}문제) — 편집 가능
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPreview(Math.max(0, currentPreview - 1))
                    }
                    disabled={currentPreview === 0}
                    className="px-2 py-1 text-sm bg-gray-200 rounded disabled:opacity-30"
                  >
                    ◀ 이전
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPreview + 1} / {generatedQuestions.length}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPreview(
                        Math.min(
                          generatedQuestions.length - 1,
                          currentPreview + 1
                        )
                      )
                    }
                    disabled={
                      currentPreview === generatedQuestions.length - 1
                    }
                    className="px-2 py-1 text-sm bg-gray-200 rounded disabled:opacity-30"
                  >
                    다음 ▶
                  </button>
                </div>
              </div>

              {currentQ && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <span className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-600">
                      {currentQ.questionTypeName}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                      {currentQ.points}점
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      지문
                    </label>
                    <textarea
                      value={currentQ.passage}
                      onChange={(e) =>
                        updateGenerated(
                          currentPreview,
                          "passage",
                          e.target.value
                        )
                      }
                      rows={6}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      발문
                    </label>
                    <input
                      type="text"
                      value={currentQ.question}
                      onChange={(e) =>
                        updateGenerated(
                          currentPreview,
                          "question",
                          e.target.value
                        )
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      선지
                    </label>
                    <div className="space-y-2">
                      {currentQ.choices.map((choice, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setGeneratedCorrect(currentPreview, i)
                            }
                            className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                              choice.isCorrect
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                            }`}
                          >
                            {choice.label}
                          </button>
                          <input
                            type="text"
                            value={choice.text}
                            onChange={(e) =>
                              updateGeneratedChoice(
                                currentPreview,
                                i,
                                e.target.value
                              )
                            }
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      해설
                    </label>
                    <textarea
                      value={currentQ.explanation}
                      onChange={(e) =>
                        updateGenerated(
                          currentPreview,
                          "explanation",
                          e.target.value
                        )
                      }
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "저장 중..."
                    : `${generatedQuestions.length}개 전체 저장`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== 수동 모드 ========== */}
      {mode === "manual" && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">문제 내용</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  문제 유형
                </label>
                <select
                  value={manualQuestionType}
                  onChange={(e) => setManualQuestionType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">선택하세요</option>
                  {questionTypes.map((qt) => (
                    <option key={qt.code} value={qt.code}>
                      {qt.number}번 - {qt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  배점
                </label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  min={1}
                  max={10}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-sm text-gray-500 ml-1">점</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                지문 (Passage)
              </label>
              <textarea
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                rows={8}
                placeholder="영어 지문을 입력하세요..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                발문 (Question)
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="예: 글의 목적으로 가장 적절한 것은?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">선지</label>
              <div className="space-y-2">
                {choices.map((choice, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setCorrectAnswer(i)}
                      className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                        choice.isCorrect
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }`}
                    >
                      {choice.label}
                    </button>
                    <input
                      type="text"
                      value={choice.text}
                      onChange={(e) => updateChoice(i, e.target.value)}
                      placeholder={`선지 ${choice.label}`}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                정답인 선지의 번호를 클릭하면 초록색으로 표시됩니다.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                해설 (선택)
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                placeholder="정답 해설을 입력하세요..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "문제 저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
