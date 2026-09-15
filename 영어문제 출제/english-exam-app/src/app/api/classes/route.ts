import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { generateUniqueClassCode } from "@/lib/class-code";

const VALID_SUBJECTS = ["english", "math", "both"];

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const classes = await prisma.class.findMany({
    include: {
      center: true,
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

  const created = await prisma.class.create({
    data: {
      name,
      grade,
      subject: validSubject,
      centerId,
      code,
      teacherId: staff.sub,
    },
    include: { center: true, _count: { select: { enrollments: true } } },
  });

  return NextResponse.json({ class: created }, { status: 201 });
}
