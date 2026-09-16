// 학생 앱 ↔ 백엔드(기존 Next 앱) 통신. 토큰(Bearer) 기반.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const TOKEN_KEY = "teb_student_token";
const STUDENT_KEY = "teb_student";

export interface Student {
  id: string;
  username: string;
  name: string;
  grade: string;
  status: string; // "enrolled" | "guest"
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStudent(): Student | null {
  try {
    const s = localStorage.getItem(STUDENT_KEY);
    return s ? (JSON.parse(s) as Student) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, student: Student) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);
  } catch {
    /* ignore */
  }
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다");
  return data;
}

export interface AuthResult {
  token: string;
  student: Student;
}

export function login(username: string, password: string): Promise<AuthResult> {
  return postJson("/api/auth/student/login", { username, password });
}

export interface RegisterInput {
  username: string;
  password: string;
  name: string;
  grade: string;
  classCode?: string;
}

export function register(input: RegisterInput): Promise<AuthResult> {
  return postJson("/api/auth/student/register", input);
}

// 인증이 필요한 GET
export async function authGet(path: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다");
  return data;
}

async function authPost(path: string, body: unknown) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다");
  return data;
}

export interface AssignmentRow {
  id: string;
  title: string;
  dueAt: string | null;
  subject: string;
  className: string;
  submission: {
    id: string;
    status: string;
    score: number;
    totalPoints: number;
    submittedAt: string | null;
  } | null;
}

export function getAssignments(): Promise<{ assignments: AssignmentRow[] }> {
  return authGet("/api/student/assignments");
}

export interface AssessmentItem {
  orderNum: number;
  questionId: string;
  questionType: string;
  points: number;
  passage: string;
  question: string;
  choices: { label: string; text: string }[];
}

export interface WorksheetSolveItem {
  itemId: string;
  number: number;
  points: number;
  choicesCount: number | null; // 객관식이면 선지 수, 주관식이면 null
}

export interface AssessmentResponse {
  assignment: { id: string; title: string; dueAt: string | null };
  type: "exam" | "worksheet";
  items: AssessmentItem[] | WorksheetSolveItem[];
  fileUrl?: string | null;
  worksheetTitle?: string;
}

export function getAssessment(
  assignmentId: string
): Promise<AssessmentResponse> {
  return authGet(`/api/student/assessments/${assignmentId}`);
}

export interface GradeResult {
  submissionId: string;
  score: number;
  totalPoints: number;
  correctCount: number;
  itemCount: number;
  rate: number;
}

export function submitAnswers(
  assignmentId: string,
  answers: { questionId: string; selected: string }[]
): Promise<GradeResult> {
  return authPost("/api/student/submissions", { assignmentId, answers });
}

export interface AreaStat {
  name: string;
  correct: number;
  total: number;
  rate: number;
}

export function getAchievement(): Promise<{
  overall: { correct: number; total: number; rate: number };
  areas: AreaStat[];
  weak: AreaStat[];
  strong: AreaStat[];
  submissionCount: number;
}> {
  return authGet("/api/student/achievement");
}

export interface WrongNote {
  id: string;
  note: string | null;
  resolved: boolean;
  createdAt: string;
  selected: string;
  question: {
    question: string;
    passage: string;
    choices: { label: string; text: string }[];
    correct: string | null;
    explanation: string | null;
  } | null;
}

export function getWrongNotes(all = false): Promise<{ notes: WrongNote[] }> {
  return authGet(`/api/student/wrong-notes${all ? "?all=1" : ""}`);
}

export async function updateWrongNote(
  id: string,
  patch: { note?: string; resolved?: boolean }
) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/student/wrong-notes/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "수정 실패");
  return data;
}

export interface TrendPoint {
  rate: number;
  at: string;
}

export function getTrend(): Promise<{ points: TrendPoint[] }> {
  return authGet("/api/student/trend");
}
