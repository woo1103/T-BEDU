// 학생용 토큰(Bearer) 인증 — PWA/모바일 대비.
// 교사/관리자는 httpOnly 쿠키 세션(src/lib/auth.ts)을 그대로 쓰고,
// 학생은 로그인 시 발급한 JWT를 Authorization: Bearer 헤더로 보낸다.
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const STUDENT_TOKEN_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    // 개발 편의용 fallback. 프로덕션은 반드시 AUTH_SECRET 설정할 것. (auth.ts와 동일 시크릿)
    return new TextEncoder().encode("dev-only-secret-change-me-tnbedu-2026");
  }
  return new TextEncoder().encode(secret);
}

export interface StudentTokenPayload {
  sub: string; // User.id
  studentId: string; // StudentProfile.id
  username: string;
  role: "student";
}

export async function signStudentToken(
  payload: StudentTokenPayload
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_TOKEN_DAYS}d`)
    .sign(getSecret());
}

export async function verifyStudentToken(
  token: string
): Promise<StudentTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "student") return null;
    return {
      sub: payload.sub as string,
      studentId: payload.studentId as string,
      username: payload.username as string,
      role: "student",
    };
  } catch {
    return null;
  }
}

// Authorization: Bearer <token> 에서 학생 세션을 추출.
// 학생 전용 API 핸들러는 반드시 이 함수로 인증하고, null이면 401을 반환해야 한다.
export async function getStudentFromRequest(
  req: NextRequest
): Promise<StudentTokenPayload | null> {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  return verifyStudentToken(token);
}
