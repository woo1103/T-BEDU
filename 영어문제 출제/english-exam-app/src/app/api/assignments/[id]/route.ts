import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 과제 수정: 마감일/활성/제목
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: { title?: string; dueAt?: Date | null; active?: boolean } = {};
  if (typeof body.title === "string" && body.title.trim())
    data.title = body.title.trim();
  if (body.dueAt !== undefined)
    data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (typeof body.active === "boolean") data.active = body.active;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data,
    include: {
      assessment: { select: { subject: true, type: true } },
      class: { select: { id: true, name: true } },
      _count: { select: { submissions: true } },
    },
  });
  return NextResponse.json({ assignment });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  await prisma.assignment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
