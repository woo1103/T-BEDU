"use client";

import { useState } from "react";

// 관리자: 전체 데이터 백업 내려받기
export default function BackupPage() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function download() {
    setState("working");
    setMessage("");
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 응답 ${res.status}`);
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "tnbedu-backup.json";
      // 받은 파일이 완전한 JSON인지 확인(중간에 끊기면 경고)
      const parsed = JSON.parse(await blob.text()) as { tableCount: number; tables: Record<string, unknown[]> };
      const rows = Object.values(parsed.tables).reduce((n, t) => n + t.length, 0);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setState("done");
      setMessage(`${name} 저장 완료 — 표 ${parsed.tableCount}개, 데이터 ${rows.toLocaleString()}건`);
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "백업에 실패했습니다.");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 백업</h1>
        <p className="text-sm text-gray-500 mt-1">
          학생·반·문제·시험지·제출 기록 등 모든 데이터를 파일 하나(JSON)로 내려받습니다.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <button
          onClick={download}
          disabled={state === "working"}
          className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
        >
          {state === "working" ? "백업 만드는 중..." : "지금 백업 내려받기"}
        </button>
        {message && (
          <p className={`text-sm ${state === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {state === "error" ? `백업 실패: ${message}` : message}
          </p>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-2">
        <p className="font-medium text-gray-800">이럴 때 받아 두세요</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>“깨진 문제 정리”처럼 여러 건을 지우기 직전</li>
          <li>학년도 진급(롤오버) 직전</li>
          <li>한 달에 한 번 정기적으로</li>
        </ul>
        <p className="text-amber-700">
          파일에 학생 개인정보와 계정 정보(암호화된 비밀번호)가 들어 있습니다. 공유 폴더나 메신저에 올리지 말고 안전한 곳에
          보관하세요.
        </p>
      </div>
    </div>
  );
}
