import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

const VALID_SUBJECTS = ["english", "math", "etc"];

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return (
      host === "youtu.be" ||
      host.endsWith("youtube.com") ||
      host.endsWith("youtube-nocookie.com")
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const videos = await prisma.video.findMany({
    include: {
      _count: { select: { assignments: true, watchProgress: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ videos });
}

// 영상 등록 (재생 URL 기반). subject: english|math|etc
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.title?.trim() || !body?.url?.trim()) {
    return NextResponse.json(
      { error: "제목과 재생 URL은 필수입니다" },
      { status: 400 }
    );
  }
  const subject = VALID_SUBJECTS.includes(body.subject) ? body.subject : "english";
  const rawUrl = body.url.trim();
  // provider가 명시되지 않았고 유튜브 링크면 자동으로 "youtube"로 저장
  const provider =
    body.provider?.trim() || (isYouTubeUrl(rawUrl) ? "youtube" : "url");

  const video = await prisma.video.create({
    data: {
      subject,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      provider,
      url: rawUrl,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
    },
    include: { _count: { select: { assignments: true, watchProgress: true } } },
  });
  return NextResponse.json({ video }, { status: 201 });
}
