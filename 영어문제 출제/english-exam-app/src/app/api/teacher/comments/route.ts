import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

const VALID_SCOPES = ["overall", "area", "submission"];

// 교사 코멘트 생성
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.studentId || !body?.body?.trim()) {
    return NextResponse.json(
      { error: "학생과 코멘트 내용은 필수입니다" },
      { status: 400 }
    );
  }
  const scope = VALID_SCOPES.includes(body.scope) ? body.scope : "overall";

  const comment = await prisma.teacherComment.create({
    data: {
      teacherId: staff.sub,
      studentId: body.studentId,
      scope,
      tagId: body.tagId || null,
      submissionId: body.submissionId || null,
      body: String(body.body).trim(),
    },
  });
  return NextResponse.json({ comment }, { status: 201 });
}
