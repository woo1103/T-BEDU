// 풀던 답 임시 저장(과제별). 앱이 꺼져도 고른 답이 남는다. 제출하면 지운다.
const key = (assignmentId: string) => `teb_draft_${assignmentId}`;
const startKey = (assignmentId: string) => `teb_start_${assignmentId}`;

export function loadDraft(assignmentId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key(assignmentId));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveDraft(assignmentId: string, selected: Record<string, string>) {
  try {
    if (Object.keys(selected).length === 0) localStorage.removeItem(key(assignmentId));
    else localStorage.setItem(key(assignmentId), JSON.stringify(selected));
  } catch {
    /* 저장 못 해도 풀이는 계속 */
  }
}

export function clearDraft(assignmentId: string) {
  try {
    localStorage.removeItem(key(assignmentId));
    localStorage.removeItem(startKey(assignmentId));
  } catch {
    /* ignore */
  }
}

// 처음 연 시각(ms). 타이머는 앱을 껐다 켜도 처음 연 때부터 센다.
export function startedAt(assignmentId: string, now = Date.now()): number {
  try {
    const raw = localStorage.getItem(startKey(assignmentId));
    const t = raw ? Number(raw) : NaN;
    if (Number.isFinite(t) && t > 0 && t <= now) return t;
    localStorage.setItem(startKey(assignmentId), String(now));
  } catch {
    /* ignore */
  }
  return now;
}

// 남은 시간 표시: "12:05", 다 되면 "00:00"
export function formatRemaining(limitMin: number, started: number, now = Date.now()): { text: string; left: number } {
  const left = Math.max(0, limitMin * 60_000 - (now - started));
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return { text: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, left };
}
