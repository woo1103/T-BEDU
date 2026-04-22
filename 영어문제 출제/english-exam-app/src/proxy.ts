import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "teb_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    return new TextEncoder().encode("dev-only-secret-change-me-tnbedu-2026");
  }
  return new TextEncoder().encode(secret);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
