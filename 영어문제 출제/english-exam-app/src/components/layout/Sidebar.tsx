"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "대시보드", icon: "📊" },
  { href: "/passages", label: "지문 관리", icon: "📖" },
  { href: "/questions", label: "문제 은행", icon: "📝" },
  { href: "/questions/new", label: "문제 만들기", icon: "✨" },
  { href: "/gen-jobs", label: "생성 작업", icon: "⏳" },
  { href: "/exams", label: "시험지 관리", icon: "📄" },
  { href: "/exams/new", label: "시험지 구성", icon: "📋" },
  { href: "/textbooks", label: "교재 관리", icon: "📚" },
  { href: "/classes", label: "반 편성", icon: "🏫" },
  { href: "/admin/students", label: "학생 관리", icon: "🧑‍🎓" },
  { href: "/admin/status", label: "현황판", icon: "📋" },
  { href: "/admin/tags", label: "문항 태그", icon: "🏷️" },
  { href: "/worksheets", label: "수학 문제지", icon: "🧮" },
  { href: "/math-bank", label: "수학 문제 은행", icon: "🏦" },
  { href: "/videos", label: "영상 강의", icon: "🎬" },
  { href: "/assignments", label: "과제 관리", icon: "🗓️" },
];

const adminItems = [
  { href: "/admin/prompts", label: "AI 지시문", icon: "🧠" },
  { href: "/admin/users", label: "계정 관리", icon: "👤" },
  { href: "/admin/ai-usage", label: "AI 사용량", icon: "💰" },
  { href: "/admin/backup", label: "데이터 백업", icon: "💾" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  // 휴대폰: 메뉴를 서랍처럼 열고 닫는다(머리글의 ☰ 버튼)
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  useEffect(() => {
    const onOpen = () => {
      setOpenedAt(pathname);
      setOpen(true);
    };
    window.addEventListener("nav:open", onOpen);
    return () => window.removeEventListener("nav:open", onOpen);
  }, [pathname]);
  // 다른 화면으로 가면 닫는다
  const drawerOpen = open && openedAt === pathname;

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setRole(d.user?.role ?? null));
  }, [pathname]);

  if (pathname === "/login") return null;

  const allItems = role === "admin" ? [...navItems, ...adminItems] : navItems;
  // /exams 와 /exams/new 처럼 겹치면 더 길게 맞는 메뉴 하나만 켠다
  const activeHref = allItems
    .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} aria-hidden />
      )}
    <aside
      className={`w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-50 overflow-y-auto transition-transform md:static md:min-h-screen md:translate-x-0 print:hidden ${
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="p-6 border-b border-slate-700 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Bench Mark</h1>
          <p className="text-slate-400 text-sm mt-1">T&amp;BEDU 교사용</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden text-slate-400 hover:text-white text-xl leading-none p-1"
          aria-label="메뉴 닫기"
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {allItems.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Powered by Claude AI
        </p>
      </div>
    </aside>
    </>
  );
}
