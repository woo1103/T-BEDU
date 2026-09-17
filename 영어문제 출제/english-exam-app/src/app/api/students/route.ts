import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// 학생만 목록 (관리자/담당자). 계정관리(교사/관리자)와 분리.
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { username: true } },
      center: { select: { name: true } },
      enrollments: {
        where: { status: "active" },
        include: { class: { select: { id: true, name: true, subject: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
      status: s.status,
      username: s.user.username,
      center: s.center?.name ?? null,
      classes: s.enrollments.map((e) => ({
        id: e.class.id,
        name: e.class.name,
        subject: e.class.subject,
      })),
      createdAt: s.createdAt,
    })),
  });
}
