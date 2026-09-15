import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { generateUniqueClassCode } from "@/lib/class-code";

const VALID_SUBJECTS = ["english", "math", "both"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const cls = await prisma.class.findUnique({
    where: { id },
    include: {
      center: true,
      enrollments: {
        where: { status: "active" },
        include: {
          student: {
            include: { user: { select: { username: true } } },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!cls) {
    return NextResponse.json({ error: "반을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json({ class: cls });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.grade === "string") data.grade = body.grade;
  if (VALID_SUBJECTS.includes(body.subject)) data.subject = body.subject;
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.regenerateCode === true) data.code = await generateUniqueClassCode();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  const updated = await prisma.class.update({
    where: { id },
    data,
    include: { center: true, _count: { select: { enrollments: true } } },
  });
  return NextResponse.json({ class: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  await prisma.class.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
