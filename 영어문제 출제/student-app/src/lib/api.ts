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

// 인증이 필요한 GET (다음 단계에서 사용)
export async function authGet(path: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다");
  return data;
}
