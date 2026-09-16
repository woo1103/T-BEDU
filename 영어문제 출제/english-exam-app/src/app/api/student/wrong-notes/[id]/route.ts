import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 오답노트 메모/완료 표시 수정 (본인만)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.wrongNote.findUnique({ where: { id } });
  if (!existing || existing.studentId !== student.studentId) {
    return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { note?: string; resolved?: boolean } = {};
  if (typeof body.note === "string") data.note = body.note;
  if (typeof body.resolved === "boolean") data.resolved = body.resolved;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  const updated = await prisma.wrongNote.update({ where: { id }, data });
  return NextResponse.json({ note: updated });
}
