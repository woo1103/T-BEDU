import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "teb_session";
// 학생 API(/api/student/*)와 학생 인증(/api/auth/student/*)은 쿠키 세션이 아니라
// Authorization: Bearer 토큰으로 인가한다. 따라서 프록시의 쿠키 게이트를 건너뛰고,
// 각 학생 API 핸들러가 getStudentFromRequest()로 직접 인증한다.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/student",
  "/api/student",
];

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    return new TextEncoder().encode("dev-only-secret-change-me-tnbedu-2026");
  }
  return new TextEncoder().encode(secret);
}

// 학생 PWA는 다른 오리진(별도 배포/포트)에서 토큰으로 호출하므로 CORS 허용.
// 토큰은 Authorization 헤더로 전달(쿠키 아님)이라 credentials 불필요 → origin "*" 허용.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function isStudentApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/student") ||
    pathname.startsWith("/api/auth/student")
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 학생 API: CORS 처리 후 통과 (인가는 각 핸들러가 Bearer로 수행)
  if (isStudentApi(pathname)) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return unauthorized(req);

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return unauthorized(req);
  }
}

function unauthorized(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/|fonts/|icon|manifest|favicon|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest|ttf|otf|woff|woff2)).*)",
  ],
};
