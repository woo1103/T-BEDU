"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { parseMarkup } from "@/lib/textbook-parser";
import TextbookRenderer, {
  type RenderQuestion,
} from "@/components/textbook/TextbookRenderer";

interface TextbookData {
  textbook: { id: string; title: string; description: string | null; content: string };
  questions: Record<string, RenderQuestion>;
}

export default function TextbookPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<TextbookData | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    fetch(`/api/textbooks/${id}?withQuestions=1`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  const nodes = useMemo(
    () => (data ? parseMarkup(data.textbook.content) : []),
    [data]
  );

  if (!data) {
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  }

  return (
    <div>
      <div className="print:hidden flex justify-between items-center mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Link href="/textbooks" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; 교재 목록
          </Link>
          <Link
            href={`/textbooks/${id}/edit`}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            편집
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
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          인쇄 / PDF 저장
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto print:shadow-none print:border-none print:p-0 print:max-w-none">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold">{data.textbook.title}</h1>
          {data.textbook.description && (
            <p className="text-sm text-gray-600 mt-2">{data.textbook.description}</p>
          )}
        </div>
        <TextbookRenderer
          nodes={nodes}
          questions={data.questions}
          showAnswers={showAnswers}
        />
      </div>
    </div>
  );
}
