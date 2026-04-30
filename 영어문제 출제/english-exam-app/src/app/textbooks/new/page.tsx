"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STARTER = `\\section{Day 1 — 단원 도입}

이 단원에서는 빈칸 추론 유형을 다룹니다. \\textbf{핵심 전략}을 먼저 익히고
연습 문제로 넘어갑니다.

\\subsection{연습 문제}

\\question{문제ID를_여기에_붙여넣으세요}

\\vspace{1em}
\\hrule

\\begin{box}
\\textbf{Tip.} 지문을 읽기 전에 발문을 먼저 확인하세요.
\\end{box}

\\pagebreak

\\section{Day 2}

\\begin{columns}{2}
왼쪽 칼럼 내용입니다. 두 단으로 조판됩니다.

오른쪽 칼럼으로 자연스럽게 흐릅니다.
\\end{columns}
`;

export default function NewTextbookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/textbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, content: STARTER }),
    });
    const data = await res.json();
    router.push(`/textbooks/${data.id}/edit`);
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <h2 className="text-lg font-bold">새 교재 만들기</h2>
      <div>
        <label className="block text-sm text-gray-600 mb-1">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="예: 고2 빈칸추론 마스터"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">설명 (선택)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <button
        disabled={submitting}
        onClick={handleCreate}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "생성 중..." : "만들고 편집하기"}
      </button>
    </div>
  );
}
