import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { generateUniqueClassCode } from "@/lib/class-code";

interface Plan {
  classId: string;
  graduate?: boolean;
  newName?: string;
  newGrade?: string;
  studentIds?: string[]; // 지정 시 해당 학생만 진급(미지정=전원)
}

// 진급 마법사: 새(또는 기존) 학년도로 반을 복제하고 학생을 이동한다.
// body: { targetTermId? | newTerm:{name,year}, plans:Plan[], copyVideos?, copyAssignments? }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const plans: Plan[] = Array.isArray(body?.plans) ? body.plans : [];
  if (plans.length === 0) {
    return NextResponse.json({ error: "진급할 반을 선택하세요" }, { status: 400 });
  }

  // 1) 대상 학년도 확정 (기존 or 신규) → 현재 학년도로 설정
  let targetTermId: string = body?.targetTermId;
  if (!targetTermId) {
    const name = body?.newTerm?.name?.trim();
    const year = Number(body?.newTerm?.year);
    if (!name || !Number.isFinite(year)) {
      return NextResponse.json(
        { error: "새 학년도 이름/연도 또는 기존 학년도를 지정하세요" },
        { status: 400 }
      );
    }
    const created = await prisma.$transaction(async (tx) => {
      await tx.academicTerm.updateMany({ data: { isCurrent: false } });
      return tx.academicTerm.create({ data: { name, year, isCurrent: true } });
    });
    targetTermId = created.id;
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.academicTerm.updateMany({ data: { isCurrent: false } });
      await tx.academicTerm.update({
        where: { id: targetTermId },
        data: { isCurrent: true },
      });
    });
  }

  let newClasses = 0;
  let movedStudents = 0;
  let graduated = 0;

  for (const plan of plans) {
    const src = await prisma.class.findUnique({
      where: { id: plan.classId },
      include: {
        enrollments: { where: { status: "active" } },
        videoAssignments: true,
        assignments: true,
      },
    });
    if (!src) continue;

    const enrollments = plan.studentIds
      ? src.enrollments.filter((e) => plan.studentIds!.includes(e.studentId))
      : src.enrollments;

    if (plan.graduate) {
      // 졸업: 학생 상태 graduated, 기존 등록 종료
      for (const e of enrollments) {
        await prisma.enrollment.update({
          where: { id: e.id },
          data: { status: "left" },
        });
        await prisma.studentProfile.update({
          where: { id: e.studentId },
          data: { status: "graduated" },
        });
        graduated++;
      }
      continue;
    }

    // 새 반 생성 (다음 학년)
    const code = await generateUniqueClassCode();
    const newClass = await prisma.class.create({
      data: {
        name: plan.newName?.trim() || src.name,
        grade: plan.newGrade?.trim() || src.grade,
        subject: src.subject,
        centerId: src.centerId,
        teacherId: src.teacherId,
        termId: targetTermId,
        code,
      },
    });
    newClasses++;

    // 학생 이동: 새 반 등록 + 기존 등록 종료 + 학년 갱신
    for (const e of enrollments) {
      await prisma.enrollment.create({
        data: { studentId: e.studentId, classId: newClass.id, status: "active" },
      });
      await prisma.enrollment.update({
        where: { id: e.id },
        data: { status: "left" },
      });
      if (plan.newGrade?.trim()) {
        await prisma.studentProfile.update({
          where: { id: e.studentId },
          data: { grade: plan.newGrade.trim() },
        });
      }
      movedStudents++;
    }

    // 콘텐츠 복사 (옵션)
    if (body?.copyVideos && src.videoAssignments.length > 0) {
      await prisma.videoAssignment.createMany({
        data: src.videoAssignments.map((v) => ({
          videoId: v.videoId,
          classId: newClass.id,
        })),
      });
    }
    if (body?.copyAssignments && src.assignments.length > 0) {
      for (const a of src.assignments) {
        await prisma.assignment.create({
          data: {
            classId: newClass.id,
            assessmentId: a.assessmentId,
            title: a.title,
            dueAt: null,
          },
        });
      }
    }
  }

  return NextResponse.json({
    targetTermId,
    newClasses,
    movedStudents,
    graduated,
  });
}
