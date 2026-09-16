import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

const VALID_SUBJECTS = ["english", "math", "etc"];

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

  const video = await prisma.video.create({
    data: {
      subject,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      provider: body.provider?.trim() || "url",
      url: body.url.trim(),
      durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
    },
    include: { _count: { select: { assignments: true, watchProgress: true } } },
  });
  return NextResponse.json({ video }, { status: 201 });
}
