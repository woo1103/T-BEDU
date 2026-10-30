// 홈 '오늘 할 일': 안 낸 과제(마감 가까운 순) → 안 본 영상 → 복습할 오답
// api.ts의 과제·영상 행 중 여기서 쓰는 부분만(시험지 앱 테스트에서도 불러 쓰도록 의존 없이)
interface AssignmentRow {
  id: string;
  title: string;
  dueAt: string | null;
  className: string;
  submission: { status: string } | null;
}
interface StudentVideo {
  id: string;
  title: string;
  progress: { percent: number; completed: boolean } | null;
}

export type TodayItem =
  | { kind: "assignment"; id: string; title: string; sub: string; due: string | null; overdue: boolean }
  | { kind: "video"; id: string; title: string; sub: string }
  | { kind: "wrong"; id: "wrong"; title: string; sub: string };

export function buildToday(
  assignments: AssignmentRow[],
  videos: StudentVideo[],
  wrongCount: number,
  now = Date.now()
): TodayItem[] {
  const todo = assignments
    .filter((a) => a.submission?.status !== "graded")
    .map((a) => {
      const dueMs = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      return { a, dueMs };
    })
    // 마감 지난 것 → 마감 가까운 것 → 마감 없는 것
    .sort((x, y) => x.dueMs - y.dueMs)
    .map(({ a, dueMs }): TodayItem => ({
      kind: "assignment",
      id: a.id,
      title: a.title,
      sub: a.className,
      due: a.dueAt,
      overdue: dueMs < now,
    }));

  const unwatched = videos
    .filter((v) => !v.progress?.completed)
    .map((v): TodayItem => ({
      kind: "video",
      id: v.id,
      title: v.title,
      sub: v.progress && v.progress.percent > 0 ? `${v.progress.percent}% 봤어요` : "아직 안 봤어요",
    }));

  const wrong: TodayItem[] =
    wrongCount > 0
      ? [{ kind: "wrong", id: "wrong", title: `복습할 오답 ${wrongCount}개`, sub: "비슷한 문제로 다시 풀어 보기" }]
      : [];

  return [...todo, ...unwatched, ...wrong];
}
