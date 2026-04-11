"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Choice } from "@/types";

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
            정답 표시
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
          {exam.items.map((item) => {
            const pts = item.customPoints || item.question.points;
            let choices: Choice[] = [];
            try {
              choices = JSON.parse(item.question.choices);
            } catch {
              /* empty */
            }

            return (
              <div
                key={item.id}
                className="border-b border-gray-200 pb-6 last:border-b-0"
              >
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

                {/* 지문 */}
                {item.question.passage && (
                  <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-gray-50 print:bg-white">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
                      {item.question.passage}
                    </p>
                  </div>
                )}

                {/* 선지 */}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
