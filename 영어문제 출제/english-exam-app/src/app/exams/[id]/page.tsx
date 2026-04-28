"use client";

import { use } from "react";
import Link from "next/link";

export default function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-gray-500">시험지 상세 페이지</p>
      <div className="flex justify-center gap-3">
        <Link
          href={`/exams/${id}/preview`}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          미리보기 및 PDF 다운로드
        </Link>
        <Link
          href={`/exams/${id}/edit`}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
        >
          편집 (문제 추가/제거)
        </Link>
      </div>
    </div>
  );
}
