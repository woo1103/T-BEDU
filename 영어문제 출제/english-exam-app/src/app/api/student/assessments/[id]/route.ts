import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 학생이 풀 문항을 내려준다 (정답 제거). [id] = assignmentId
// 영어(exam): 문항 텍스트+선지. 수학(worksheet): 문제지 파일 + 문항 메타(정답키 제외).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      assessment: {
        include: {
          exam: {
            include: {
              items: { include: { question: true }, orderBy: { orderNum: "asc" } },
            },
          },
          worksheet: { include: { items: { orderBy: { number: "asc" } } } },
        },
      },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  }

  const enrolled = await prisma.enrollment.findFirst({
    where: {
      studentId: student.studentId,
      classId: assignment.classId,
      status: "active",
    },
  });
  if (!enrolled) {
    return NextResponse.json({ error: "이 과제에 접근할 수 없습니다" }, { status: 403 });
  }

  const type = assignment.assessment.type;
  const base = {
    assignment: { id: assignment.id, title: assignment.title, dueAt: assignment.dueAt },
    type,
  };

  if (type === "worksheet") {
    const ws = assignment.assessment.worksheet;
    const items = (ws?.items ?? []).map((it) => ({
      itemId: it.id,
      number: it.number,
      points: it.points,
      choicesCount: it.choicesCount,
    }));
    return NextResponse.json({
      ...base,
      fileUrl: ws?.fileUrl ?? null,
      worksheetTitle: ws?.title ?? "",
      items,
    });
  }

  const exam = assignment.assessment.exam;
  const items = (exam?.items ?? []).map((item) => {
    let choices: { label: string; text: string }[] = [];
    try {
      choices = (
        JSON.parse(item.question.choices) as { label: string; text: string }[]
      ).map((c) => ({ label: c.label, text: c.text }));
    } catch {
      /* empty */
    }
    return {
      orderNum: item.orderNum,
      questionId: item.question.id,
      questionType: item.question.questionType,
      points: item.customPoints ?? item.question.points,
      passage: item.question.passage,
      question: item.question.question,
      choices,
    };
  });

  return NextResponse.json({ ...base, items });
}
