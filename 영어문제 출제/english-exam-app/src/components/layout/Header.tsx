"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const pageTitles: Record<string, string> = {
  "/": "대시보드",
  "/questions": "문제 은행",
  "/questions/new": "문제 만들기",
  "/exams": "시험지 관리",
  "/exams/new": "시험지 구성",
  "/textbooks": "교재 관리",
  "/admin/users": "계정 관리",
};

interface Me {
  id: string;
  username: string;
  role: "admin" | "teacher";
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setMe(d.user));
  }, [pathname]);

  if (pathname === "/login") return null;

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/questions/") ? "문제 상세" : "") ||
    (pathname.startsWith("/exams/") ? "시험지 상세" : "") ||
    (pathname.startsWith("/textbooks/") ? "교재 편집" : "") ||
    "영어 문제 출제";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 sticky top-0 z-30 md:static">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => window.dispatchEvent(new Event("nav:open"))}
            className="md:hidden -ml-1 p-2 rounded-lg text-gray-700 hover:bg-gray-100 text-xl leading-none"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <h2 className="text-lg md:text-2xl font-bold text-gray-800 truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <span className="hidden md:inline text-sm text-gray-500">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          {me && (
            <>
              <span className="hidden sm:inline text-sm text-gray-700">
                <span className="font-medium">{me.username}</span>
                <span className="text-xs text-gray-400 ml-1">
                  ({me.role === "admin" ? "관리자" : "담당자"})
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
