"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EXAM_TYPE_MAP, getQuestionTypeInfo, getQuestionTypes, DIFFICULTY_MAP, canGenerateWithAi, SET_DEFS, isSetLeadType } from "@/lib/question-types";
import { pickFromBank, SUNEUNG_PRESETS, type ComposePreset } from "@/lib/auto-compose";
import { withSetMembers } from "@/lib/question-sets";
import { VARIATIONS } from "@/lib/variations";
import ExamComposer from "@/components/exams/ExamComposer";
import type { ExamType, Choice, Difficulty } from "@/types";

const CIRCLE_LABELS = ["①", "②", "③", "④", "⑤"];

function isWritingType(questionType: string): boolean {
  return questionType.startsWith("naesin_writing");
}

interface AiTypeSel {
  code: string;
  name: string;
  count: number;
}

interface AiGenerated {
  passage: string;
  question: string;
  choices: Choice[];
  answer: string;
  explanation: string;
  points: number;
  questionType: string;
  questionTypeName: string;
  include: boolean;
  verifySig?: string; // 생성 API 검수 통과 서명
}

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
  verifyStatus?: string | null;
  examItems?: unknown[];
  setId?: string | null;
  passageRef: {
    id: string;
    textbook: string;
    grade: string;
    lesson: string;
    title: string | null;
  } | null;
}

interface SelectedItem {
  questionId: string;
  question: QuestionRow;
  orderNum: number;
  customPoints?: number | null;
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
  const [examSource, setExamSource] = useState("");
  const [instructions, setInstructions] = useState(
    "문항에 따라 배점이 다릅니다. 3점 문항에는 점수가 표시되어 있습니다. 점수 표시가 없는 문항은 모두 2점입니다."
  );

  // 문제 선택
  const [availableQuestions, setAvailableQuestions] = useState<QuestionRow[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // ===== AI 문제 생성 (시험지 구성 내부) =====
  const [showAi, setShowAi] = useState(false);
  const [aiTypes, setAiTypes] = useState<AiTypeSel[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [aiTopic, setAiTopic] = useState("");
  const [aiPassage, setAiPassage] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiResults, setAiResults] = useState<AiGenerated[]>([]);
  const [aiVariations, setAiVariations] = useState<string[]>([]);

  function toggleAiVariation(key: string) {
    setAiVariations((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // ===== 학년별·유형별 자동 구성 =====
  const [gyOpen, setGyOpen] = useState(false);
  const [gyGrade, setGyGrade] = useState("고1");
  const [gyTypes, setGyTypes] = useState<AiTypeSel[]>([]);
  const [gyRunning, setGyRunning] = useState(false);
  const [gyLog, setGyLog] = useState("");
  const [gyAllowNoGrade, setGyAllowNoGrade] = useState(true);
  const GY_GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];

  function toggleGyType(code: string, name: string) {
    setGyTypes((prev) => {
      const ex = prev.find((t) => t.code === code);
      if (ex) return prev.filter((t) => t.code !== code);
      return [...prev, { code, name, count: 1 }];
    });
  }
  function applyPreset(preset: ComposePreset) {
    setGyTypes(
      preset.types.map((t) => ({
        code: t.code,
        name: `${getQuestionTypeInfo(examType, t.code)?.number ?? ""}번 ${getQuestionTypeInfo(examType, t.code)?.name ?? t.code}`,
        count: t.count,
      }))
    );
    setGyLog("");
  }
  function updateGyCount(code: string, count: number) {
    setGyTypes((prev) =>
      prev.map((t) => (t.code === code ? { ...t, count: Math.max(1, count) } : t))
    );
  }

  // 학년+유형별: 은행에서 우선 채우고, 모자라면 AI로 부족분 생성
  async function autoCompose() {
    if (gyTypes.length === 0) {
      alert("유형을 1개 이상 선택하세요.");
      return;
    }
    // 먼저 계획을 세워 AI로 만들 문항 수를 알려 준다(시간·비용이 드는 일이므로)
    const alreadySelected = new Set(selectedItems.map((i) => i.questionId));
    const plan = gyTypes.map((t) => {
      const take = pickFromBank(availableQuestions, t.code, t.count, {
        grade: gyGrade,
        allowNoGrade: gyAllowNoGrade,
        exclude: alreadySelected,
      });
      take.forEach((q) => alreadySelected.add(q.id));
      const shortfall = t.count - take.length;
      const ai = canGenerateWithAi(examType, t.code);
      return { t, take, generate: ai ? shortfall : 0, missing: ai ? 0 : shortfall };
    });
    const toGenerate = plan.reduce((n, p) => n + p.generate, 0);
    const missingNames = plan.filter((p) => p.missing > 0).map((p) => p.t.name);
    if (toGenerate > 0) {
      // 장문 세트는 한 세트가 2~3문항
      const size = (code: string) => SET_DEFS[code]?.length ?? 1;
      const fromBank = plan.reduce((n, p) => n + p.take.length * size(p.t.code), 0);
      const newCount = plan.reduce((n, p) => n + p.generate * size(p.t.code), 0);
      const ok = confirm(
        `은행에서 ${fromBank}문항을 넣고, 모자란 ${newCount}문항은 AI로 새로 만듭니다.
` +
          (missingNames.length > 0
            ? `(${missingNames.join(", ")}: AI로 만들 수 없고 은행에도 없어 비워 둡니다)
`
            : "") +
          `1문항에 30초~1분쯤 걸려요. 서버가 만들어서, 창을 닫아도 문제 은행에 저장돼요. 진행할까요?`
      );
      if (!ok) return;
    }

    setGyRunning(true);
    setGyLog("");
    let picked = 0;
    for (const { take } of plan) {
      if (take.length > 0) {
        addQuestions(take);
        picked += take.length;
      }
    }

    // 모자란 문항은 서버에 맡긴다: 이 탭을 닫아도 서버가 만들어 문제 은행에 저장한다
    let generated = 0;
    let failed = 0;
    if (toGenerate > 0) {
      try {
        const res = await fetch("/api/gen-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examType,
            difficulty: "medium",
            title: `${title || "시험지"} 자동 구성 ${toGenerate}문항`,
            items: plan.filter((p) => p.generate > 0).map((p) => ({ questionType: p.t.code, count: p.generate })),
          }),
        });
        const job = await res.json();
        if (!res.ok) throw new Error(job.error || "생성 작업을 만들지 못했어요.");
        // 끝날 때까지 진행 상황을 보여 준다
        for (;;) {
          await new Promise((r) => setTimeout(r, 4000));
          const d = await (await fetch(`/api/gen-jobs/${job.id}`)).json();
          generated = d.done ?? 0;
          failed = d.failed ?? 0;
          setGyLog(`AI로 만드는 중... ${generated + failed}/${d.total} (이 창을 닫아도 '생성 작업'에서 이어져요)`);
          if (d.status !== "running") {
            const newIds = (d.items as { questionId: string | null }[]).map((i) => i.questionId).filter(Boolean);
            if (newIds.length > 0) {
              const fresh = (await (await fetch("/api/questions")).json()) as QuestionRow[];
              setAvailableQuestions(fresh);
              addQuestions(fresh.filter((q) => newIds.includes(q.id)), fresh);
            }
            break;
          }
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "생성 작업을 만들지 못했어요.");
      }
    }

    setGyRunning(false);
    const notes = [
      failed > 0 ? `생성 실패 ${failed}문항('생성 작업'에서 다시 시도)` : "",
      missingNames.length > 0 ? `은행에 없어 비운 유형: ${missingNames.join(", ")}` : "",
    ].filter(Boolean);
    setGyLog(`완료: 은행 ${picked}문항 + 새로 만든 ${generated}문항 추가${notes.length ? " · " + notes.join(" · ") : ""}`);
  }

  const aiQuestionTypes = getQuestionTypes(examType);
  const aiTypesTotal = aiTypes.reduce((sum, t) => sum + t.count, 0);

  function toggleAiType(code: string, name: string) {
    setAiTypes((prev) => {
      const exists = prev.find((t) => t.code === code);
      if (exists) return prev.filter((t) => t.code !== code);
      return [...prev, { code, name, count: 1 }];
    });
  }
  function updateAiTypeCount(code: string, count: number) {
    setAiTypes((prev) =>
      prev.map((t) => (t.code === code ? { ...t, count: Math.max(1, count) } : t))
    );
  }

  async function handleAiGenerate() {
    if (aiTypes.length === 0) {
      alert("최소 1개 이상의 문제 유형을 선택해주세요.");
      return;
    }
    setAiGenerating(true);
    setAiResults([]);
    const results: AiGenerated[] = [];
    for (const t of aiTypes) {
      const siblings: { question: string; answer?: string }[] = [];
      for (let i = 0; i < t.count; i++) {
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              examType,
              questionType: t.code,
              difficulty: aiDifficulty,
              topic: aiTopic,
              sourcePassage: aiPassage.trim() || undefined,
              passageMode: aiPassage.trim() ? "original" : undefined,
              variations: aiVariations.length > 0 ? aiVariations : undefined,
              priorQuestions: siblings.length > 0 ? siblings : undefined,
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
            answer: data.answer || "",
            explanation: data.explanation || "",
            verifySig: data.verifySig,
            points: data.points || 2,
            questionType: t.code,
            questionTypeName: t.name,
            include: true,
          });
          siblings.push({ question: data.question || "", answer: data.answer || undefined });
          setAiResults([...results]);
        } catch (err) {
          alert(`${t.name} ${i + 1}번째 생성 실패: ${err instanceof Error ? err.message : "오류"}`);
        }
      }
    }
    setAiResults(results);
    setAiGenerating(false);
  }

  async function handleAiSaveAndAdd() {
    const picks = aiResults.filter((q) => q.include);
    if (picks.length === 0) {
      alert("추가할 문제를 1개 이상 선택해주세요.");
      return;
    }
    setAiSaving(true);
    const savedIds: string[] = [];
    for (const q of picks) {
      const writing = isWritingType(q.questionType);
      const correctIndex = q.choices.findIndex((c) => c.isCorrect);
      const answer = writing ? q.answer : q.choices[correctIndex]?.label || "";
      try {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examType,
            questionType: q.questionType,
            points: q.points,
            passage: q.passage,
            question: q.question,
            choices: writing ? [] : q.choices,
            answer,
            explanation: q.explanation,
            difficulty: aiDifficulty,
            aiGenerated: true,
            source: "AI 생성 (Claude)",
            verifySig: q.verifySig,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id) savedIds.push(data.id as string);
        }
      } catch {
        /* skip */
      }
    }
    // 문제 은행 새로고침 후 새 문제들을 시험지에 자동 추가
    try {
      const fresh = await fetch("/api/questions").then((r) => r.json());
      setAvailableQuestions(fresh);
      addQuestions((fresh as QuestionRow[]).filter((q) => savedIds.includes(q.id)));
    } catch {
      /* ignore */
    }
    setAiSaving(false);
    setShowAi(false);
    setAiResults([]);
    setAiTypes([]);
    setAiTopic("");
    setAiPassage("");
    alert(`${savedIds.length}개 문제를 생성해 시험지에 추가했습니다.`);
  }

  // 문제 목록 불러오기: 실패(로그인 만료·서버 오류·시간 초과)해도 "불러오는 중"에 멈추지 않고 이유와 다시 시도 버튼을 보인다
  const [questionsError, setQuestionsError] = useState("");
  async function loadQuestions() {
    setLoadingQuestions(true);
    setQuestionsError("");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch("/api/questions", { signal: ctrl.signal });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* JSON이 아닌 응답(서버 오류 페이지 등) */
      }
      if (res.status === 401) throw new Error("로그인이 만료됐어요. 다시 로그인해 주세요.");
      if (!res.ok || !Array.isArray(data)) {
        const msg = (data as { error?: string } | null)?.error;
        throw new Error(`문제 목록을 불러오지 못했어요 (${res.status}${msg ? ` · ${msg}` : ""})`);
      }
      setAvailableQuestions(data as QuestionRow[]);
    } catch (e) {
      setQuestionsError(
        e instanceof Error && e.name === "AbortError"
          ? "문제 목록을 불러오는 데 1분 넘게 걸려 멈췄어요."
          : e instanceof Error
            ? e.message
            : "문제 목록을 불러오지 못했어요"
      );
    } finally {
      clearTimeout(timer);
      setLoadingQuestions(false);
    }
  }
  useEffect(() => {
    loadQuestions();
  }, []);

  // 장문 세트 문항은 세트 전체가 번호 순으로 함께 들어간다
  function addQuestions(qs: QuestionRow[], bank: QuestionRow[] = availableQuestions) {
    const expanded = withSetMembers(qs, [...bank, ...qs]);
    setSelectedItems((prev) => {
      const existing = new Set(prev.map((i) => i.questionId));
      const toAdd = expanded.filter((q) => !existing.has(q.id));
      const merged = [
        ...prev,
        ...toAdd.map((q) => ({
          questionId: q.id,
          question: q,
          orderNum: 0,
        })),
      ];
      return merged.map((item, i) => ({ ...item, orderNum: i + 1 }));
    });
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
          grade: grade || undefined,
          source: examSource || undefined,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className="block text-sm text-gray-600 mb-1">지문 출처</label>
            <input
              type="text"
              value={examSource}
              onChange={(e) => setExamSource(e.target.value)}
              placeholder="교과서/올림포스/모의고사 등"
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

      {/* 학년별·유형별 자동 구성 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <button
          onClick={() => setGyOpen((v) => !v)}
          className="flex items-center gap-2 font-semibold text-gray-800"
        >
          <span>🎯 학년별·유형별 자동 구성</span>
          <span className="text-xs text-gray-400">{gyOpen ? "▲" : "▼"}</span>
        </button>
        {gyOpen && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-gray-500">
              학년과 유형·개수를 정하면 <b>문제 은행에서 먼저 채우고, 모자라면 AI가 부족분만 생성</b>해 시험지에 추가합니다.
            </p>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">학년</label>
              <select
                value={gyGrade}
                onChange={(e) => setGyGrade(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {GY_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
                <input type="checkbox" checked={gyAllowNoGrade} onChange={(e) => setGyAllowNoGrade(e.target.checked)} />
                학년 정보가 없는 은행 문제도 쓰기(AI로 만든 문제 등)
              </label>
            </div>

            {examType === "suneung" && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">한 번에 고르기</p>
                <div className="flex flex-wrap gap-2">
                  {SUNEUNG_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p)}
                      className="px-3 py-2 rounded-lg border border-blue-200 bg-white text-left hover:bg-blue-50"
                    >
                      <span className="block text-sm font-medium text-blue-800">{p.label}</span>
                      <span className="block text-xs text-gray-500">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 유형 선택 */}
            {(() => {
              const cats = new Map<string, typeof aiQuestionTypes>();
              aiQuestionTypes.forEach((qt) => {
                if (!cats.has(qt.category)) cats.set(qt.category, []);
                cats.get(qt.category)!.push(qt);
              });
              return Array.from(cats.entries()).map(([cat, types]) => (
                <div key={cat}>
                  <p className="text-xs text-gray-400 font-medium mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((qt) => {
                      const sel = gyTypes.some((t) => t.code === qt.code);
                      return (
                        <button
                          key={qt.code}
                          onClick={() => toggleGyType(qt.code, `${qt.number}번 ${qt.name}`)}
                          title={canGenerateWithAi(examType, qt.code) ? undefined : "AI 출제 미지원 — 은행에 있는 문제로만 채워요"}
                          className={`px-2.5 py-1 rounded-lg text-xs ${
                            sel
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {qt.number}번 {qt.name}
                          {!canGenerateWithAi(examType, qt.code) && <span className="ml-1 opacity-70">(은행만)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}

            {/* 선택 유형별 개수 */}
            {gyTypes.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                {gyTypes.map((st) => (
                  <div key={st.code} className="flex items-center gap-3 bg-blue-50 rounded-lg px-3 py-1.5">
                    <span className="text-sm text-blue-800 flex-1">{st.name}</span>
                    <button onClick={() => updateGyCount(st.code, st.count - 1)} className="w-6 h-6 rounded bg-blue-200 text-blue-700 text-sm">-</button>
                    <span className="text-sm font-medium w-6 text-center">{st.count}</span>
                    <button onClick={() => updateGyCount(st.code, st.count + 1)} className="w-6 h-6 rounded bg-blue-200 text-blue-700 text-sm">+</button>
                    <span className="text-xs text-blue-600">문항</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={autoCompose}
                disabled={gyRunning || gyTypes.length === 0}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {gyRunning ? "구성 중..." : "자동 구성"}
              </button>
              {gyLog && <span className="text-xs text-gray-500">{gyLog}</span>}
            </div>
          </div>
        )}
      </div>

      {/* 문제 고르기: 왼쪽 문제 카드 · 오른쪽 시험지 미리보기 */}
      {loadingQuestions ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-gray-400">문제 은행 불러오는 중...</div>
      ) : questionsError ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-red-600 space-y-2">
          <p>{questionsError}</p>
          <button onClick={loadQuestions} className="px-3 py-1.5 text-xs rounded-lg border border-red-200 hover:bg-red-50">
            다시 불러오기
          </button>
        </div>
      ) : (
        <ExamComposer
          questions={availableQuestions}
          items={selectedItems}
          onItemsChange={setSelectedItems}
          onQuestionUpdated={(q) => setAvailableQuestions((list) => list.map((x) => (x.id === q.id ? q : x)))}
          header={{ title, school, grade }}
          bankActions={
            <button
              onClick={() => setShowAi(true)}
              className="text-xs bg-purple-600 text-white hover:bg-purple-700 font-medium px-3 py-1.5 rounded"
              title="AI로 새 영어 문제를 생성해 이 시험지에 바로 추가합니다"
            >
              ✨ AI 문제 생성
            </button>
          }
        />
      )}

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

      {/* AI 문제 생성 모달 */}
      {showAi && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !aiGenerating && !aiSaving && setShowAi(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">✨ AI 영어 문제 생성</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  현재 시험 유형: {EXAM_TYPE_MAP[examType]?.name} · 생성 후 이 시험지에 바로 추가됩니다.
                </p>
              </div>
              <button
                onClick={() => setShowAi(false)}
                disabled={aiGenerating || aiSaving}
                className="text-gray-400 hover:text-gray-600 text-xl disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {/* 난이도 */}
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
                    onClick={() => setAiDifficulty(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      aiDifficulty === key
                        ? val.color + " ring-2 ring-offset-1 ring-current"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {val.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 유형 선택 */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">문제 유형 (복수 선택)</label>
              {(() => {
                const categories = new Map<string, typeof aiQuestionTypes>();
                aiQuestionTypes.forEach((qt) => {
                  if (!categories.has(qt.category)) categories.set(qt.category, []);
                  categories.get(qt.category)!.push(qt);
                });
                return Array.from(categories.entries()).map(([cat, types]) => (
                  <div key={cat} className="mb-2">
                    <p className="text-xs text-gray-400 font-medium mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {types.map((qt) => {
                        const isSel = aiTypes.some((t) => t.code === qt.code);
                        return (
                          <button
                            key={qt.code}
                            onClick={() => toggleAiType(qt.code, qt.name)}
                            disabled={!canGenerateWithAi(examType, qt.code) || isSetLeadType(qt.code)}
                            title={
                              isSetLeadType(qt.code)
                                ? "장문 세트는 위의 '학년별·유형별 자동 구성'으로 넣어 주세요"
                                : canGenerateWithAi(examType, qt.code)
                                ? undefined
                                : "아직 AI로 만들 수 없는 유형이에요"
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              isSel
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
              {aiTypes.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mt-2 space-y-2">
                  {aiTypes.map((st) => (
                    <div key={st.code} className="flex items-center gap-3 bg-purple-50 rounded-lg px-3 py-1.5">
                      <span className="text-sm text-purple-800 flex-1">{st.name}</span>
                      <button onClick={() => updateAiTypeCount(st.code, st.count - 1)} className="w-6 h-6 rounded bg-purple-200 text-purple-700 text-sm">-</button>
                      <span className="text-sm font-medium w-6 text-center">{st.count}</span>
                      <button onClick={() => updateAiTypeCount(st.code, st.count + 1)} className="w-6 h-6 rounded bg-purple-200 text-purple-700 text-sm">+</button>
                      <button onClick={() => toggleAiType(st.code, st.name)} className="text-red-400 hover:text-red-600 text-sm ml-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 주제 + 지문 */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">주제/키워드 (선택)</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="예: 환경, 기술, 교육..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">출제 지문 (선택 — 비우면 AI가 새 지문 생성)</label>
                <textarea
                  value={aiPassage}
                  onChange={(e) => setAiPassage(e.target.value)}
                  rows={4}
                  placeholder="교과서/원본 영어 지문을 붙여넣으면 그 지문으로 출제합니다."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
                />
              </div>
            </div>

            {/* 고난도 변형 갈래 */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                고난도 변형 갈래 (선택 · 복수 가능)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VARIATIONS.map((v) => {
                  const on = aiVariations.includes(v.key);
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => toggleAiVariation(v.key)}
                      title={v.desc}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                        on
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || aiTypes.length === 0}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {aiGenerating
                ? `생성 중... (${aiResults.length}/${aiTypesTotal})`
                : `${aiTypesTotal}개 문제 AI 생성`}
            </button>

            {/* 생성 결과 */}
            {aiResults.length > 0 && (
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  생성 결과 ({aiResults.filter((r) => r.include).length}/{aiResults.length}개 선택됨) — 체크한 문제만 추가됩니다
                </p>
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {aiResults.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 p-2 rounded border border-gray-200 text-sm">
                      <input
                        type="checkbox"
                        checked={q.include}
                        onChange={() =>
                          setAiResults((prev) =>
                            prev.map((r, ri) => (ri === i ? { ...r, include: !r.include } : r))
                          )
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1.5 mb-1">
                          <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{q.questionTypeName}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{q.points}점</span>
                        </div>
                        <p className="text-gray-700 truncate">{q.question}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAi(false)}
                    disabled={aiSaving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                  >
                    닫기
                  </button>
                  <button
                    onClick={handleAiSaveAndAdd}
                    disabled={aiSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {aiSaving ? "저장 중..." : "선택 문제 시험지에 추가"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
