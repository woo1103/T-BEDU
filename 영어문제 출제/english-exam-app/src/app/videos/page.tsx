"use client";

import { useEffect, useState } from "react";

interface VideoRow {
  id: string;
  subject: string;
  title: string;
  url: string;
  _count: { assignments: number; watchProgress: number };
}
interface ClassRow {
  id: string;
  name: string;
  center: { name: string };
}

const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  etc: "기타",
};

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("english");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [vRes, cRes] = await Promise.all([
      fetch("/api/videos"),
      fetch("/api/classes"),
    ]);
    setVideos((await vRes.json()).videos || []);
    setClasses((await cRes.json()).classes || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!title.trim() || !url.trim()) {
      alert("제목과 재생 URL을 입력하세요.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, title, url, description }),
    });
    setSaving(false);
    if (!res.ok) {
      alert((await res.json()).error || "저장 실패");
      return;
    }
    setTitle("");
    setUrl("");
    setDescription("");
    await load();
  }

  async function assign(v: VideoRow) {
    if (classes.length === 0) {
      alert("먼저 반을 만들어 주세요.");
      return;
    }
    const list = classes.map((c, i) => `${i + 1}. ${c.center.name} ${c.name}`).join("\n");
    const pick = prompt(`영상을 노출할 반 번호:\n${list}`);
    if (!pick) return;
    const cls = classes[parseInt(pick, 10) - 1];
    if (!cls) return;
    const res = await fetch(`/api/videos/${v.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: cls.id }),
    });
    if (res.ok) {
      alert(`'${cls.name}'에 노출되었습니다.`);
      await load();
    } else alert((await res.json()).error || "실패");
  }

  async function remove(v: VideoRow) {
    if (!confirm("이 영상을 삭제할까요?")) return;
    const res = await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">영상 강의</h2>
        <p className="text-sm text-gray-500 mt-1">
          재생 URL(HLS .m3u8 또는 mp4)을 등록하고 반에 노출하면, 학생 앱에서 시청·진도율이
          기록됩니다.
        </p>
      </div>

      {/* 등록 폼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800">새 영상 등록</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="english">영어</option>
            <option value="math">수학</option>
            <option value="etc">기타</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="영상 제목"
            className="md:col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="재생 URL (.m3u8 또는 .mp4)"
            className="md:col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            className="md:col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={create}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? "저장 중..." : "영상 등록"}
        </button>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 font-semibold text-gray-800">
          등록된 영상 {loading ? "" : `(${videos.length})`}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : videos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">등록된 영상이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {videos.map((v) => (
              <li key={v.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {SUBJECT_LABEL[v.subject] || v.subject}
                    </span>
                    <p className="font-medium text-gray-800 truncate">{v.title}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    노출 {v._count.assignments}개 반 · 시청 {v._count.watchProgress}명
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => assign(v)}
                    className="text-sm px-3 py-1.5 bg-[#245B3E] text-white rounded-lg"
                  >
                    반 노출
                  </button>
                  <button
                    onClick={() => remove(v)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
