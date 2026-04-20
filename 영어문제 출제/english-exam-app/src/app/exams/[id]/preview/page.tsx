"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Choice } from "@/types";
import {
  parsePassage,
  isWritingType,
  type ParsedPassage,
  type OrderParsed,
  type InsertionParsed,
  type GrammarParsed,
  type SummaryParsed,
} from "@/lib/passage-parser";

const PDFDownloadButton = dynamic(
  () => import("@/components/pdf/PDFDownloadButton"),
  { ssr: false }
);

interface ExamQuestion {
  id: string;
  passage: string;
  question: string;
  choices: string;
  answer: string;
  points: number;
  questionType: string;
}

interface ExamItemWithQuestion {
  id: string;
  orderNum: number;
  customPoints: number | null;
  question: ExamQuestion;
}

interface ExamDetail {
  id: string;
  title: string;
  examType: string;
  totalPoints: number;
  timeLimit: number | null;
  headerInfo: string | null;
  instructions: string | null;
  items: ExamItemWithQuestion[];
}

// ── 순서배열 렌더러 ──
function OrderRenderer({
  parsed,
  choices,
  showAnswers,
}: {
  parsed: OrderParsed;
  choices: Choice[];
  showAnswers: boolean;
}) {
  return (
    <>
      {/* 주어진 글 박스 */}
      <div className="border-2 border-gray-800 rounded-lg p-4 mb-4 bg-white">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {parsed.givenParagraph}
        </p>
      </div>

      {/* (A)(B)(C) 세그먼트 */}
      {parsed.segments.map((seg, i) => (
        <div key={i} className="mb-3 ml-2">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            <span className="font-bold mr-1">{seg.label}</span>
            {seg.text}
          </p>
        </div>
      ))}

      {/* 선지 */}
      <div className="grid grid-cols-1 gap-1 ml-6 mt-3">
        {choices.map((choice, i) => (
          <p
            key={i}
            className={`text-sm py-0.5 ${
              showAnswers && choice.isCorrect
                ? "text-red-600 font-bold"
                : "text-gray-700"
            }`}
          >
            {choice.label} {choice.text}
            {showAnswers && choice.isCorrect && " ◀ 정답"}
          </p>
        ))}
      </div>
    </>
  );
}

// ── 문장삽입 렌더러 ──
function InsertionRenderer({
  parsed,
  choices,
  showAnswers,
}: {
  parsed: InsertionParsed;
  choices: Choice[];
  showAnswers: boolean;
}) {
  return (
    <>
      {/* 주어진 문장 박스 */}
      <div className="border-2 border-gray-800 rounded-lg p-4 mb-4 bg-white">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {parsed.givenSentence}
        </p>
      </div>

      {/* 본문 (인라인 마커 포함) */}
      <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-gray-50 print:bg-white">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {parsed.bodyParts.map((part, i) =>
            part.marker ? (
              <span key={i} className="font-bold mx-1">
                {"( "}
                {part.marker}
                {" )"}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </p>
      </div>

      {/* 선지 (위치 번호) */}
      {choices.length > 0 && (
        <div className="grid grid-cols-5 gap-2 ml-6 mt-3">
          {choices.map((choice, i) => (
            <p
              key={i}
              className={`text-sm py-0.5 ${
                showAnswers && choice.isCorrect
                  ? "text-red-600 font-bold"
                  : "text-gray-700"
              }`}
            >
              {choice.label} {choice.text}
              {showAnswers && choice.isCorrect && " ◀"}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ── 어법/어휘 렌더러 ──
function GrammarRenderer({
  parsed,
  choices,
  showAnswers,
}: {
  parsed: GrammarParsed;
  choices: Choice[];
  showAnswers: boolean;
}) {
  return (
    <>
      {/* 지문 (밑줄+마커 포함) */}
      <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-gray-50 print:bg-white">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {parsed.parts.map((part, i) =>
            part.underlined ? (
              <span key={i}>
                <span className="font-bold text-xs align-super mr-0.5">
                  {part.marker}
                </span>
                <span className="underline decoration-1">{part.underlined}</span>
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </p>
      </div>

      {/* 선지 */}
      <div className="grid grid-cols-1 gap-1 ml-6 mt-3">
        {choices.map((choice, i) => (
          <p
            key={i}
            className={`text-sm py-0.5 ${
              showAnswers && choice.isCorrect
                ? "text-red-600 font-bold"
                : "text-gray-700"
            }`}
          >
            {choice.label} {choice.text}
            {showAnswers && choice.isCorrect && " ◀ 정답"}
          </p>
        ))}
      </div>
    </>
  );
}

// ── 요약문 렌더러 ──
function SummaryRenderer({
  parsed,
  choices,
  showAnswers,
}: {
  parsed: SummaryParsed;
  choices: Choice[];
  showAnswers: boolean;
}) {
  // choices에서 (A)/(B) 쌍 파싱
  const parsedChoices = choices.map((c) => {
    const match = c.text.match(
      /\(A\)\s*(\S+)\s*[…·\-—]+\s*\(B\)\s*(\S+)/
    );
    return {
      a: match ? match[1] : c.text,
      b: match ? match[2] : "",
      isCorrect: c.isCorrect,
      label: c.label,
    };
  });

  return (
    <>
      {/* 본문 박스 */}
      <div className="border border-gray-300 rounded-lg p-4 mb-2 bg-gray-50 print:bg-white">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {parsed.mainPassage}
        </p>
      </div>

      {/* 화살표 */}
      <div className="text-center text-2xl text-gray-400 my-2">⬇</div>

      {/* 요약문 박스 */}
      <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-gray-50 print:bg-white">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {parsed.summaryText}
        </p>
      </div>

      {/* (A)/(B) 선지 표 */}
      <div className="ml-6 mt-3">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-1 text-left"></th>
              <th className="px-4 py-1 text-center">(A)</th>
              <th className="px-4 py-1 text-center"></th>
              <th className="px-4 py-1 text-center">(B)</th>
            </tr>
          </thead>
          <tbody>
            {parsedChoices.map((c, i) => (
              <tr
                key={i}
                className={
                  showAnswers && c.isCorrect
                    ? "text-red-600 font-bold"
                    : "text-gray-700"
                }
              >
                <td className="px-4 py-0.5">{c.label}</td>
                <td className="px-4 py-0.5">{c.a}</td>
                <td className="px-4 py-0.5 text-gray-400">……</td>
                <td className="px-4 py-0.5">{c.b}</td>
                {showAnswers && c.isCorrect && (
                  <td className="px-2 py-0.5">◀ 정답</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── 서술형 렌더러 ──
function WritingRenderer({
  passage,
  choices,
  showAnswers,
}: {
  passage: string;
  choices: Choice[];
  showAnswers: boolean;
}) {
  return (
    <>
      {/* 지문 */}
      {passage && (
        <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-gray-50 print:bg-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {passage}
          </p>
        </div>
      )}

      {/* 답안 작성 영역 표시 */}
      <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-3 min-h-[80px]">
        <p className="text-xs text-gray-400">답안 작성란</p>
      </div>

      {/* 해설지 모드에서만 모범답안/채점기준 표시 */}
      {showAnswers && choices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3">
          <p className="text-xs font-bold text-red-700 mb-2">
            [채점 기준 / 모범답안]
          </p>
          {choices.map((choice, i) => (
            <p
              key={i}
              className={`text-sm py-0.5 ${
                choice.isCorrect
                  ? "text-red-600 font-bold"
                  : "text-gray-700"
              }`}
            >
              {choice.text}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ── 기본 렌더러 ──
function DefaultRenderer({
  passage,
  choices,
  showAnswers,
}: {
  passage: string;
  choices: Choice[];
  showAnswers: boolean;
}) {
  return (
    <>
      {passage && (
        <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-gray-50 print:bg-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {passage}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-1 ml-6">
        {choices.map((choice, i) => (
          <p
            key={i}
            className={`text-sm py-0.5 ${
              showAnswers && choice.isCorrect
                ? "text-red-600 font-bold"
                : "text-gray-700"
            }`}
          >
            {choice.label} {choice.text}
            {showAnswers && choice.isCorrect && " ◀ 정답"}
          </p>
        ))}
      </div>
    </>
  );
}

// ── 문항 렌더러 (유형별 분기) ──
function QuestionRenderer({
  item,
  showAnswers,
}: {
  item: ExamItemWithQuestion;
  showAnswers: boolean;
}) {
  const pts = item.customPoints || item.question.points;
  let choices: Choice[] = [];
  try {
    choices = JSON.parse(item.question.choices);
  } catch {
    /* empty */
  }

  const parsed: ParsedPassage = parsePassage(
    item.question.passage,
    item.question.questionType
  );

  return (
    <div className="border-b border-gray-200 pb-6 last:border-b-0">
      {/* 문항 번호 + 배점 + 발문 */}
      <div className="flex items-start gap-2 mb-3">
        <span className="font-bold text-lg">{item.orderNum}.</span>
        {pts >= 3 && (
          <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded mt-1">
            {pts}점
          </span>
        )}
        <p className="font-medium text-gray-800 flex-1">
          {item.question.question}
        </p>
      </div>

      {/* 유형별 렌더링 */}
      {parsed.type === "order" && (
        <OrderRenderer
          parsed={parsed}
          choices={choices}
          showAnswers={showAnswers}
        />
      )}
      {parsed.type === "insertion" && (
        <InsertionRenderer
          parsed={parsed}
          choices={choices}
          showAnswers={showAnswers}
        />
      )}
      {parsed.type === "grammar" && (
        <GrammarRenderer
          parsed={parsed}
          choices={choices}
          showAnswers={showAnswers}
        />
      )}
      {parsed.type === "summary" && (
        <SummaryRenderer
          parsed={parsed}
          choices={choices}
          showAnswers={showAnswers}
        />
      )}
      {parsed.type === "writing" && (
        <WritingRenderer
          passage={parsed.passage}
          choices={choices}
          showAnswers={showAnswers}
        />
      )}
      {parsed.type === "default" && (
        <DefaultRenderer
          passage={parsed.text}
          choices={choices}
          showAnswers={showAnswers}
        />
      )}
    </div>
  );
}

export default function ExamPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setExam(data);
        setLoading(false);
      });
  }, [id]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  }

  if (!exam) {
    return <div className="text-center text-gray-400 py-12">시험지를 찾을 수 없습니다.</div>;
  }

  const headerInfo = exam.headerInfo ? JSON.parse(exam.headerInfo) : {};

  return (
    <div>
      {/* 컨트롤 바 (인쇄 시 숨김) */}
      <div className="print:hidden flex justify-between items-center mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Link
            href="/exams"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; 시험지 목록
          </Link>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
              className="rounded"
            />
            정답/해설 표시
          </label>
        </div>
        <div className="flex gap-2">
          <PDFDownloadButton exam={exam} showAnswers={showAnswers} />
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
          >
            브라우저 인쇄
          </button>
        </div>
      </div>

      {/* 시험지 본문 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto print:shadow-none print:border-none print:p-0 print:max-w-none">
        {/* 헤더 */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          {headerInfo.school && (
            <p className="text-lg font-bold">{headerInfo.school}</p>
          )}
          <h1 className="text-2xl font-bold mt-2">{exam.title}</h1>
          <div className="flex justify-center gap-6 mt-2 text-sm text-gray-600">
            {headerInfo.grade && <span>{headerInfo.grade}</span>}
            {headerInfo.date && <span>{headerInfo.date}</span>}
            {exam.timeLimit && <span>시험 시간: {exam.timeLimit}분</span>}
            <span>총점: {exam.totalPoints}점</span>
          </div>
          <div className="mt-3 flex justify-end">
            <span className="text-sm">
              이름: __________________ 번호: ________
            </span>
          </div>
        </div>

        {/* 안내사항 */}
        {exam.instructions && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700 print:bg-white print:border print:border-gray-300">
            {exam.instructions}
          </div>
        )}

        {/* 문항들 */}
        <div className="space-y-8">
          {exam.items.map((item) => (
            <QuestionRenderer
              key={item.id}
              item={item}
              showAnswers={showAnswers}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
