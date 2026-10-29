"use client";

import { useEffect, useState } from "react";
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

// 선생님 브라우저에 기억하는 출력 설정(시험마다 다른 시험명·학년은 기억하지 않음)
const PREFS_KEY = "pdf-print-prefs";
interface Prefs {
  template: Template;
  period: string;
  subject: string;
  includeListening: boolean;
}
function loadPrefs(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
  } catch {
    return {};
  }
}

function headerGrade(headerInfo: string | null): string {
  try {
    return (JSON.parse(headerInfo ?? "{}") as { grade?: string }).grade ?? "";
  } catch {
    return "";
  }
}

export default function PDFDownloadButton({ exam, showAnswers }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  // 이 컴포넌트는 브라우저에서만 불러오므로(ssr: false) 처음부터 저장된 설정을 읽어도 된다
  const [prefs] = useState(loadPrefs);
  const [template, setTemplate] = useState<Template>(prefs.template === "mock" ? "mock" : "daily");
  const [mock, setMock] = useState<MockExamOptions>(() => ({
    examName: `${exam.title} 문제지`,
    period: prefs.period || "제 3 교시",
    subject: prefs.subject || "영어 영역",
    grade: headerGrade(exam.headerInfo),
    includeListening: prefs.includeListening ?? true,
  }));
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const next: Prefs = { template, period: mock.period, subject: mock.subject, includeListening: mock.includeListening };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* 저장 못 해도 동작 */
    }
  }, [template, mock.period, mock.subject, mock.includeListening]);

  // 미리보기 창을 닫으면 만든 PDF 메모리 해제
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  async function handlePreview(mode: "student" | "teacher") {
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
      setPreview({ url: URL.createObjectURL(blob), name: `${exam.title}_${tag}${suffix}.pdf` });
    } catch (err) {
      console.error("PDF 생성 오류:", err);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(null);
    }
  }

  function download() {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          onClick={() => handlePreview("student")}
          disabled={generating !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating === "student" ? "만드는 중..." : "학생용 PDF"}
        </button>
        <button
          onClick={() => handlePreview("teacher")}
          disabled={generating !== null}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {generating === "teacher" ? "만드는 중..." : "해설지 PDF"}
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

      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="PDF 미리보기"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800 truncate">{preview.name}</span>
              <button
                onClick={download}
                className="ml-auto px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800"
              >
                내려받기
              </button>
              <button onClick={() => setPreview(null)} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                닫기
              </button>
            </div>
            <iframe src={preview.url} title="PDF 미리보기" className="flex-1 w-full bg-gray-100" />
          </div>
        </div>
      )}
    </div>
  );
}
