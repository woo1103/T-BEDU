import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "영어 문제 출제",
  description: "AI 기반 영어 시험 문제 출제 및 시험지 생성 도구",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "영어출제",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-full flex">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var KEY = "chunk-reload";
                var COOLDOWN = 30000;
                function shouldReload(msg) {
                  if (!msg) return false;
                  msg = String(msg);
                  return (
                    msg.indexOf("ChunkLoadError") !== -1 ||
                    msg.indexOf("Loading chunk") !== -1 ||
                    msg.indexOf("Failed to fetch dynamically imported module") !== -1 ||
                    msg.indexOf("module factory is not available") !== -1
                  );
                }
                function reloadOnce() {
                  try {
                    var last = Number(sessionStorage.getItem(KEY) || 0);
                    if (Date.now() - last < COOLDOWN) return;
                    sessionStorage.setItem(KEY, String(Date.now()));
                  } catch (e) {}
                  location.reload();
                }
                window.addEventListener("error", function (e) {
                  var msg = (e.error && e.error.message) || e.message;
                  if (shouldReload(msg)) {
                    e.preventDefault();
                    reloadOnce();
                  }
                }, true);
                window.addEventListener("unhandledrejection", function (e) {
                  var r = e.reason;
                  var msg = (r && r.message) || r;
                  if (shouldReload(msg)) {
                    e.preventDefault();
                    reloadOnce();
                  }
                });
              })();
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function (regs) {
                  regs.forEach(function (reg) { reg.update(); });
                });
                navigator.serviceWorker.register('/sw.js');
              }
            `,
          }}
        />
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
          <Header />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
