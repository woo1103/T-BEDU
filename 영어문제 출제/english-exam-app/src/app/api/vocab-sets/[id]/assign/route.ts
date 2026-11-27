import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, isAdmin } from "@/lib/api-auth";

// 세트를 배정할 반 목록을 통째로 바꾼다. body: { classIds: string[] }
// 담당자는 본인 담당반만 바꿀 수 있고, 다른 선생님 반의 배정은 그대로 둔다.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const want: string[] = Array.isArray(body?.classIds)
    ? body.classIds.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const scope = isAdmin(staff) ? {} : { teacherId: staff.sub };
  const mine = (await prisma.class.findMany({ where: scope, select: { id: true } })).map((c) => c.id);
  const mineSet = new Set(mine);
  const wantMine = want.filter((c) => mineSet.has(c));

  await prisma.$transaction([
    prisma.vocabAssignment.deleteMany({ where: { setId: id, classId: { in: mine, notIn: wantMine } } }),
    ...wantMine.map((classId) =>
      prisma.vocabAssignment.upsert({
        where: { setId_classId: { setId: id, classId } },
        create: { setId: id, classId },
        update: {},
      })
    ),
  ]);
  return NextResponse.json({ ok: true, classIds: wantMine });
}
