import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";

// 학생이 풀 문항을 내려준다 (정답/isCorrect 제거). [id] = assignmentId
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
              items: {
                include: { question: true },
                orderBy: { orderNum: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  }

  // 본인이 그 반 소속인지 확인 (인가)
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

  const exam = assignment.assessment.exam;
  const items = (exam?.items || []).map((item) => {
    let choices: { label: string; text: string }[] = [];
    try {
      const parsed = JSON.parse(item.question.choices) as {
        label: string;
        text: string;
      }[];
      // 정답 정보(isCorrect) 제거하고 label/text만
      choices = parsed.map((c) => ({ label: c.label, text: c.text }));
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

  return NextResponse.json({
    assignment: { id: assignment.id, title: assignment.title, dueAt: assignment.dueAt },
    items,
  });
}
