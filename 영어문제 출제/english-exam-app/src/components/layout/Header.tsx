"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "대시보드",
  "/questions": "문제 은행",
  "/questions/new": "문제 만들기",
  "/exams": "시험지 관리",
  "/exams/new": "시험지 구성",
};

export default function Header() {
  const pathname = usePathname();

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/questions/") ? "문제 상세" : "") ||
    (pathname.startsWith("/exams/") ? "시험지 상세" : "") ||
    "영어 문제 출제";

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </header>
  );
}
