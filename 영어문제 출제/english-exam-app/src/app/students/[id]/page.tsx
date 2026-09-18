"use client";

import { useEffect, useState, use } from "react";

interface AreaStat {
  name: string;
  correct: number;
  total: number;
  rate: number;
}
interface Comment {
  id: string;
  scope: string;
  body: string;
  updatedAt: string;
}
interface Data {
  student: {
    id: string;
    name: string;
    username: string;
    grade: string;
    status: string;
    center: string | null;
    classes: string[];
  };
  achievement: {
    overall: { correct: number; total: number; rate: number };
    areas: AreaStat[];
    weak: AreaStat[];
    strong: AreaStat[];
    submissionCount: number;
  };
  submissions: {
    id: string;
    title: string;
    score: number;
    totalPoints: number;
    rate: number;
    submittedAt: string | null;
  }[];
  comments: Comment[];
  videoProgress: {
    videoId: string;
    title: string;
    subject: string;
    percent: number;
    completed: boolean;
    updatedAt: string;
  }[];
}

const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  etc: "기타",
};

function barColor(rate: number) {
  if (rate < 60) return "bg-red-400";
  if (rate < 80) return "bg-yellow-400";
  return "bg-green-500";
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");

  async function load() {
    const res = await fetch(`/api/teacher/students/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addComment() {
    if (!newComment.trim()) return;
    const res = await fetch("/api/teacher/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: id, scope: "overall", body: newComment }),
    });
    if (res.ok) {
      setNewComment("");
      await load();
    }
  }
  async function editComment(c: Comment) {
    const v = prompt("코멘트 수정", c.body);
    if (v === null || v.trim() === c.body) return;
    const res = await fetch(`/api/teacher/comments/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: v.trim() }),
    });
    if (res.ok) await load();
  }
  async function deleteComment(c: Comment) {
    if (!confirm("코멘트를 삭제할까요?")) return;
    const res = await fetch(`/api/teacher/comments/${c.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading)
    return <div className="text-center text-gray-400 py-12">불러오는 중...</div>;
  if (!data)
    return <div className="text-center text-gray-400 py-12">학생을 찾을 수 없습니다.</div>;

  const { student, achievement, submissions, comments, videoProgress } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 프로필 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              student.status === "enrolled"
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {student.status === "enrolled" ? "재원생" : "비재원생"}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {student.username} · {student.grade}
          {student.center && ` · ${student.center}`}
          {student.classes.length > 0 && ` · ${student.classes.join(", ")}`}
        </p>
      </div>

      {/* 성취도 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-semibold text-gray-800">성취도</h3>
          <span className="text-2xl font-bold text-[#245B3E]">
            {achievement.overall.rate}%
          </span>
        </div>
        {achievement.overall.total === 0 ? (
          <p className="text-sm text-gray-400">아직 제출한 문제가 없습니다.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">
              전체 {achievement.overall.correct}/{achievement.overall.total}문항 · 응시{" "}
              {achievement.submissionCount}회
            </p>
            <div className="space-y-2">
              {achievement.areas.map((a) => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24 shrink-0">{a.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${barColor(a.rate)}`}
                      style={{ width: `${a.rate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {a.rate}% ({a.correct}/{a.total})
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {achievement.weak.map((a) => (
                <span
                  key={a.name}
                  className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full"
                >
                  취약: {a.name}
                </span>
              ))}
              {achievement.strong.map((a) => (
                <span
                  key={a.name}
                  className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"
                >
                  강점: {a.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 교사 코멘트 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-3">교사 코멘트</h3>
        <div className="flex gap-2 mb-4">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addComment()}
            placeholder="학생에게 남길 코멘트 (취약점 보완 방향 등)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={addComment}
            className="px-4 py-2 bg-[#245B3E] text-white text-sm rounded-lg"
          >
            추가
          </button>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400">아직 코멘트가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(c.updatedAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => editComment(c)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteComment(c)}
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

      {/* 최근 제출 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-3">최근 제출</h3>
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-400">제출 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{s.title}</span>
                <span className="text-sm text-gray-500">
                  {s.score}/{s.totalPoints}점 ({s.rate}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 영상 시청 진도 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-3">영상 시청 진도</h3>
        {videoProgress.length === 0 ? (
          <p className="text-sm text-gray-400">시청 기록이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {videoProgress.map((v) => (
              <li key={v.videoId} className="flex items-center gap-3">
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                  {SUBJECT_LABEL[v.subject] || v.subject}
                </span>
                <span className="text-sm text-gray-700 truncate flex-1">{v.title}</span>
                <div className="w-28 bg-gray-100 rounded-full h-2 shrink-0">
                  <div
                    className={`h-2 rounded-full ${v.completed ? "bg-green-500" : "bg-[#245B3E]"}`}
                    style={{ width: `${v.percent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right shrink-0">
                  {v.completed ? "완료" : `${v.percent}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
