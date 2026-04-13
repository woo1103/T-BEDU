import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE_NAME = "teb_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    // 개발 편의용 fallback. 프로덕션은 반드시 AUTH_SECRET 설정할 것.
    return new TextEncoder().encode("dev-only-secret-change-me-tnbedu-2026");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string; // user id
  username: string;
  role: "admin" | "teacher";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as "admin" | "teacher",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export const SESSION_COOKIE = COOKIE_NAME;

// 첫 부팅 시 기본 관리자 시드
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "tnbedu2026!";

export async function ensureSeedAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return;
  const username = process.env.SEED_ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: "admin",
    },
  });
}
