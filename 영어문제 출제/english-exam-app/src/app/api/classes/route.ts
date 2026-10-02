import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, classScopeWhere } from "@/lib/api-auth";
import { generateUniqueClassCode } from "@/lib/class-code";
import { getCurrentTermId } from "@/lib/terms";

const VALID_SUBJECTS = ["english", "math", "both"];

export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  // ?termId= 로 학년도 필터. "current"면 현재 학년도.
  // 담당자는 본인 담당반만, 관리자는 전체.
  const termParam = new URL(request.url).searchParams.get("termId");
  const where: { termId?: string; teacherId?: string } = {
    ...classScopeWhere(staff),
  };
  if (termParam === "current") {
    const cur = await getCurrentTermId();
    if (cur) where.termId = cur;
  } else if (termParam) {
    where.termId = termParam;
  }

  const classes = await prisma.class.findMany({
    where,
    include: {
      center: true,
      term: { select: { id: true, name: true, year: true } },
      teacher: { select: { id: true, username: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ classes });
}

export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });

  const { name, grade, subject, centerId } = body;
  if (!name || !grade || !centerId) {
    return NextResponse.json(
      { error: "반 이름·학년·센터는 필수입니다" },
      { status: 400 }
    );
  }

  const center = await prisma.center.findUnique({ where: { id: centerId } });
  if (!center) {
    return NextResponse.json({ error: "센터를 찾을 수 없습니다" }, { status: 400 });
  }

  const validSubject = VALID_SUBJECTS.includes(subject) ? subject : "both";
  const code = await generateUniqueClassCode();
  // 새 반은 현재 학년도(또는 body.termId)에 소속
  const termId = body.termId || (await getCurrentTermId());

  const created = await prisma.class.create({
    data: {
      name,
      grade,
      subject: validSubject,
      centerId,
      code,
      teacherId: staff.sub,
      termId: termId || undefined,
    },
    include: {
      center: true,
      term: { select: { id: true, name: true, year: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json({ class: created }, { status: 201 });
}
