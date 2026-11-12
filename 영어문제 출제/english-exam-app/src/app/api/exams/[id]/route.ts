import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { describeExamUsage, examUsage } from "@/lib/usage-check";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      items: { include: { question: true }, orderBy: { orderNum: "asc" } },
    },
  });

  if (!exam) {
    return NextResponse.json({ error: "시험지를 찾을 수 없습니다" }, { status: 404 });
  }

  // usage: 편집 화면이 '이미 푼 학생이 있으면 복제해서 수정'을 안내하는 데 쓴다
  return NextResponse.json({ ...exam, usage: await examUsage(id) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // 기존 items 삭제 후 새로 생성
  await prisma.examItem.deleteMany({ where: { examId: id } });

  const exam = await prisma.exam.update({
    where: { id },
    data: {
      title: body.title,
      examType: body.examType,
      description: body.description || null,
      totalPoints: body.totalPoints || 100,
      timeLimit: body.timeLimit || null,
      headerInfo: body.headerInfo ? JSON.stringify(body.headerInfo) : null,
      instructions: body.instructions || null,
      items: body.items
        ? {
            create: body.items.map(
              (item: { questionId: string; orderNum: number; customPoints?: number }) => ({
                questionId: item.questionId,
                orderNum: item.orderNum,
                customPoints: item.customPoints || null,
              })
            ),
          }
        : undefined,
    },
    include: { items: { include: { question: true } } },
  });

  return NextResponse.json(exam);
}

// 삭제: 학생 제출이 있으면 막는다(점수 기록이 문항 없는 과제에 매달리지 않게).
// 제출 없는 과제만 있으면 ?force=1 일 때 그 과제들도 함께 지운다.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const usage = await examUsage(id);
  if (usage.submissions > 0) {
    return NextResponse.json(
      { error: `이미 학생이 푼 시험지는 지울 수 없어요. ${describeExamUsage(usage)} 과제 관리에서 과제를 먼저 정리해 주세요.`, usage },
      { status: 409 }
    );
  }
  if (usage.assignments > 0 && request.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ error: describeExamUsage(usage), usage, needsForce: true }, { status: 409 });
  }
  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { assessment: { examId: id } } }),
    prisma.assessment.deleteMany({ where: { examId: id } }),
    prisma.exam.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true, removedAssignments: usage.assignments });
}
