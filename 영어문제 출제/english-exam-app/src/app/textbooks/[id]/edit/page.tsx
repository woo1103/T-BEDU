"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { extractQuestionIds, parseMarkup } from "@/lib/textbook-parser";
import TextbookRenderer, {
  type RenderQuestion,
} from "@/components/textbook/TextbookRenderer";

const COMMAND_HELP = [
  ["\\section{제목}", "큰 제목"],
  ["\\subsection{제목}", "중간 제목"],
  ["\\question{문제ID}", "문제 은행에서 삽입"],
  ["\\passage{영문}", "지문 박스"],
  ["\\textbf{x}", "굵게"],
  ["\\textit{x}", "기울임"],
  ["\\underline{x}", "밑줄"],
  ["\\sout{x}", "취소선"],
  ["\\textcolor{red}{x}", "글자색 (red/blue/green/orange/purple/teal/#hex)"],
  ["\\hl{x}", "형광펜 (노랑)"],
  ["\\\\", "강제 줄바꿈"],
  ["\\hspace{1em}", "가로 여백"],
  ["~", "논브레이킹 스페이스"],
  ["\\vspace{1em}", "세로 여백"],
  ["\\hrule", "가로선"],
  ["\\pagebreak", "페이지 나눔"],
  ["\\begin{box}...\\end{box}", "테두리 박스"],
  ["\\begin{tipbox}{💡 Tip}...\\end{tipbox}", "Tip 박스 (파랑)"],
  ["\\begin{pointbox}{🌟 Point}...\\end{pointbox}", "Point 박스 (보라)"],
  ["\\begin{warnbox}{⚠️ 주의}...\\end{warnbox}", "주의 박스 (빨강)"],
  ["\\begin{infobox}{ℹ️ 참고}...\\end{infobox}", "참고 박스 (초록)"],
  ["\\begin{itemize}\\item ...\\end{itemize}", "글머리표"],
  ["\\begin{columns}{2}...\\end{columns}", "다단 조판"],
  ["\\begin{center}...\\end{center}", "가운데 정렬"],
];

export default function EditTextbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [questions, setQuestions] = useState<Record<string, RenderQuestion>>({});
  const fetchedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/textbooks/${id}?withQuestions=1`)
      .then((r) => r.json())
      .then((d) => {
        setTitle(d.textbook.title);
        setDescription(d.textbook.description || "");
        setContent(d.textbook.content);
        setQuestions(d.questions || {});
        Object.keys(d.questions || {}).forEach((qid) => fetchedIds.current.add(qid));
        setLoading(false);
      });
  }, [id]);

  const nodes = useMemo(() => parseMarkup(content), [content]);

  // 새로 등장한 question id 자동 fetch
  useEffect(() => {
    const ids = extractQuestionIds(content).filter(
      (qid) => !fetchedIds.current.has(qid)
    );
    if (ids.length === 0) return;
    ids.forEach((qid) => fetchedIds.current.add(qid));
    fetch(`/api/questions?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((arr: RenderQuestion[]) => {
        setQuestions((prev) => {
          const next = { ...prev };
          for (const q of arr) next[q.id] = q;
          return next;
        });
      });
  }, [content]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/textbooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, content }),
    });
    setSaving(false);
    setSavedAt(new Date());
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <Link href="/textbooks" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; 교재 목록
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium"
          placeholder="제목"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          placeholder="설명 (선택)"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <Link
          href={`/textbooks/${id}/preview`}
          className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          미리보기
        </Link>
        {savedAt && (
          <span className="text-xs text-gray-400">
            저장됨: {savedAt.toLocaleTimeString("ko-KR")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <span>마크업</span>
            <details className="relative">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                명령어 도움말
              </summary>
              <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-80 text-gray-700">
                <table className="w-full text-xs">
                  <tbody>
                    {COMMAND_HELP.map(([cmd, desc]) => (
                      <tr key={cmd}>
                        <td className="font-mono py-0.5 pr-2 text-blue-700 whitespace-nowrap">
                          {cmd}
                        </td>
                        <td className="py-0.5 text-gray-600">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none min-h-[600px]"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
            미리보기
          </div>
          <div className="p-6 overflow-auto min-h-[600px]">
            <TextbookRenderer nodes={nodes} questions={questions} />
          </div>
        </div>
      </div>
    </div>
  );
}
