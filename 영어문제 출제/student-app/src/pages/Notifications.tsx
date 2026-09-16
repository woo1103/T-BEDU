import { useEffect, useState } from "react";
import {
  getNotifications,
  markNotificationsRead,
  type AppNotification,
} from "../lib/api";

const TYPE_ICON: Record<string, string> = {
  new_video: "🎬",
  new_assignment: "🗓️",
  result: "📊",
  due: "⏰",
  notice: "📢",
};

export default function Notifications({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await getNotifications();
    setItems(d.notifications);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // 진입 시 전체 읽음 처리
    markNotificationsRead().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f6f5] pb-10">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onDone} className="text-white/80 text-lg leading-none">
          ‹
        </button>
        <span className="font-semibold">알림</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            알림이 없습니다.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl p-4 shadow-sm ${
                n.read ? "bg-white" : "bg-[#245B3E]/5 border border-[#245B3E]/20"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{TYPE_ICON[n.type] || "🔔"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{n.title}</p>
                  {n.body && (
                    <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
