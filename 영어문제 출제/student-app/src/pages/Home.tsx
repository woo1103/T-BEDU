import { useEffect, useState } from "react";
import {
  getAssignments,
  getAchievement,
  getTrend,
  type Student,
  type AssignmentRow,
  type AreaStat,
  type TrendPoint,
} from "../lib/api";

interface Props {
  student: Student;
  onLogout: () => void;
  onSolve: (assignmentId: string, title: string) => void;
  onWrongNotes: () => void;
  onVideos: () => void;
}

interface Achievement {
  overall: { correct: number; total: number; rate: number };
  weak: AreaStat[];
  strong: AreaStat[];
  areas: AreaStat[];
  submissionCount: number;
}

export default function Home({
  student,
  onLogout,
  onSolve,
  onWrongNotes,
  onVideos,
}: Props) {
  const enrolled = student.status === "enrolled";
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [ach, setAch] = useState<Achievement | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, ac, tr] = await Promise.all([
          getAssignments(),
          getAchievement(),
          getTrend(),
        ]);
        setAssignments(a.assignments);
        setAch(ac);
        setTrend(tr.points);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f6f5] pb-10">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/15 font-serif text-sm font-bold flex items-center justify-center">
            T&amp;B
          </div>
          <span className="font-semibold">T&amp;BEDU 학습</span>
        </div>
        <button onClick={onLogout} className="text-sm text-white/80 underline">
          로그아웃
        </button>
      </header>

      <main className="p-5 max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-xl font-bold text-gray-900">{student.name} 님</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{student.grade}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                enrolled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {enrolled ? "재원생" : "체험(비재원생)"}
            </span>
          </div>
        </div>

        {!enrolled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            반 코드로 가입하면 반 과제·성취도 분석을 이용할 수 있어요.
          </div>
        )}

        {/* 성취도 요약 */}
        {ach && ach.submissionCount > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-gray-800">나의 성취도</h3>
              <span className="text-2xl font-bold text-[#245B3E]">
                {ach.overall.rate}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              전체 {ach.overall.correct}/{ach.overall.total}문항 · 응시 {ach.submissionCount}회
            </p>
            {ach.weak.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">보완이 필요한 영역</p>
                <div className="flex flex-wrap gap-1.5">
                  {ach.weak.map((a) => (
                    <span
                      key={a.name}
                      className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full"
                    >
                      {a.name} {a.rate}%
                    </span>
                  ))}
                </div>
              </div>
            )}
            {ach.strong.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">강점 영역</p>
                <div className="flex flex-wrap gap-1.5">
                  {ach.strong.map((a) => (
                    <span
                      key={a.name}
                      className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"
                    >
                      {a.name} {a.rate}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {trend.length >= 2 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">성적 추이</p>
                <div className="flex items-end gap-1 h-16">
                  {trend.map((p, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#245B3E]/80 rounded-t"
                      style={{ height: `${Math.max(4, p.rate)}%` }}
                      title={`${p.rate}%`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1 text-right">
                  최근 {trend.length}회 · 최신 {trend[trend.length - 1].rate}%
                </p>
              </div>
            )}
          </div>
        )}

        {enrolled && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onWrongNotes}
              className="bg-white rounded-2xl p-4 shadow-sm text-left"
            >
              <span className="block font-medium text-gray-800">오답노트</span>
              <span className="text-sm text-[#245B3E]">복습하기 ›</span>
            </button>
            <button
              onClick={onVideos}
              className="bg-white rounded-2xl p-4 shadow-sm text-left"
            >
              <span className="block font-medium text-gray-800">영상 강의</span>
              <span className="text-sm text-[#245B3E]">시청하기 ›</span>
            </button>
          </div>
        )}

        {/* 과제 목록 */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-2 px-1">과제</h3>
          {loading ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
              불러오는 중...
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
              배정된 과제가 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => {
                const done = a.submission?.status === "graded";
                return (
                  <li
                    key={a.id}
                    className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.className}
                        {done &&
                          ` · 점수 ${a.submission!.score}/${a.submission!.totalPoints}`}
                      </p>
                    </div>
                    <button
                      onClick={() => onSolve(a.id, a.title)}
                      className={`shrink-0 text-sm px-4 py-2 rounded-xl font-medium ${
                        done
                          ? "bg-gray-100 text-gray-600"
                          : "bg-[#245B3E] text-white"
                      }`}
                    >
                      {done ? "다시 풀기" : "풀기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
