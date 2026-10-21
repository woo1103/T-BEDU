"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import ExamPDF from "./ExamPDF";
import MockExamPDF, { type MockExamOptions } from "./MockExamPDF";

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

interface Props {
  exam: ExamDetail;
  showAnswers: boolean;
}

type Template = "daily" | "mock";

function headerGrade(headerInfo: string | null): string {
  try {
    return (JSON.parse(headerInfo ?? "{}") as { grade?: string }).grade ?? "";
  } catch {
    return "";
  }
}

export default function PDFDownloadButton({ exam, showAnswers }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("daily");
  const [mock, setMock] = useState<MockExamOptions>(() => ({
    examName: `${exam.title} 문제지`,
    period: "제 3 교시",
    subject: "영어 영역",
    grade: headerGrade(exam.headerInfo),
    includeListening: true,
  }));

  async function handleDownload(mode: "student" | "teacher") {
    setGenerating(mode);
    try {
      const doc =
        template === "mock" ? (
          <MockExamPDF items={exam.items} options={mock} mode={mode} showAnswers={showAnswers} />
        ) : (
          <ExamPDF
            title={exam.title}
            items={exam.items}
            showAnswers={mode === "teacher" ? true : showAnswers}
            mode={mode}
          />
        );
      const blob = await pdf(doc).toBlob();

      const suffix = mode === "teacher" ? "_해설지" : "";
      const tag = template === "mock" ? "모의고사" : "Daily_Gift";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exam.title}_${tag}${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF 생성 오류:", err);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(null);
    }
  }

  const input = "px-2 py-1 border border-gray-300 rounded text-sm";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 items-center">
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value as Template)}
          className={input}
          aria-label="시험지 양식"
        >
          <option value="daily">Daily Gift 양식</option>
          <option value="mock">모의고사 양식</option>
        </select>
        <button
          onClick={() => handleDownload("student")}
          disabled={generating !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating === "student" ? "생성 중..." : "학생용 PDF"}
        </button>
        <button
          onClick={() => handleDownload("teacher")}
          disabled={generating !== null}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {generating === "teacher" ? "생성 중..." : "해설지 PDF"}
        </button>
      </div>

      {template === "mock" && (
        <div className="flex flex-wrap gap-2 items-center justify-end text-sm bg-gray-50 border border-gray-200 rounded-lg p-2">
          <input
            className={`${input} w-64`}
            value={mock.examName}
            onChange={(e) => setMock({ ...mock, examName: e.target.value })}
            placeholder="시험명 (예: 2026학년도 10월 고1 모의고사 문제지)"
            aria-label="시험명"
          />
          <input
            className={`${input} w-24`}
            value={mock.period}
            onChange={(e) => setMock({ ...mock, period: e.target.value })}
            placeholder="제 3 교시"
            aria-label="교시"
          />
          <input
            className={`${input} w-16`}
            value={mock.grade}
            onChange={(e) => setMock({ ...mock, grade: e.target.value })}
            placeholder="고1"
            aria-label="학년"
          />
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={mock.includeListening}
              onChange={(e) => setMock({ ...mock, includeListening: e.target.checked })}
            />
            듣기 안내 포함(독해 18번부터)
          </label>
        </div>
      )}
    </div>
  );
}
