"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import ExamPDF from "./ExamPDF";

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

export default function PDFDownloadButton({ exam, showAnswers }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);

  async function handleDownload(mode: "student" | "teacher") {
    setGenerating(mode);
    try {
      const blob = await pdf(
        <ExamPDF
          title={exam.title}
          items={exam.items}
          showAnswers={mode === "teacher" ? true : showAnswers}
          mode={mode}
        />
      ).toBlob();

      const suffix = mode === "teacher" ? "_해설지" : "";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exam.title}_Daily_Gift${suffix}.pdf`;
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

  return (
    <div className="flex gap-2">
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
  );
}
