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
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      const blob = await pdf(
        <ExamPDF
          title={exam.title}
          items={exam.items}
          showAnswers={showAnswers}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exam.title}_Daily_Gift.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF 생성 오류:", err);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {generating ? "PDF 생성 중..." : "PDF 다운로드"}
    </button>
  );
}
