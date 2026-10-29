import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { normalizeMarkerChoices } from "@/lib/passage-parser";
import { stripFigurePlaceholder } from "@/lib/math-worksheet";

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
  // 지정 학생 과제면 대상자만 접근
  if (assignment.studentIds) {
    try {
      const ids = JSON.parse(assignment.studentIds) as string[];
      if (Array.isArray(ids) && ids.length > 0 && !ids.includes(student.studentId)) {
        return NextResponse.json({ error: "배정 대상이 아닙니다" }, { status: 403 });
      }
    } catch {
      /* ignore */
    }
  }

  const type = assignment.assessment.type;
  const base = {
    assignment: { id: assignment.id, title: assignment.title, dueAt: assignment.dueAt },
    type,
  };

  if (type === "worksheet") {
    const ws = assignment.assessment.worksheet;
    // 문제은행으로 만든 학습지: 문제 본문(LaTeX)과 그림을 함께 보낸다(파일이 없으므로).
    // 학생 앱은 헤더 토큰으로 인증해 <img>로 보호된 그림을 직접 못 받으므로 그림은 data URL로 싣는다.
    const problemIds = (ws?.items ?? []).map((it) => it.mathProblemId).filter((x): x is string => !!x);
    const problems = problemIds.length
      ? await prisma.mathProblem.findMany({
          where: { id: { in: problemIds } },
          select: { id: true, problemLatex: true, figureImageId: true },
        })
      : [];
    const figureIds = problems.map((p) => p.figureImageId).filter((x): x is string => !!x);
    const images = figureIds.length
      ? await prisma.mathImage.findMany({ where: { id: { in: figureIds } }, select: { id: true, mime: true, data: true } })
      : [];
    const MAX_FIGURE_BYTES = 3_000_000; // 응답 크기 제한(약 4.5MB) 안쪽으로
    let used = 0;
    const figureUrl = new Map<string, string>();
    for (const img of images) {
      if (used + img.data.length > MAX_FIGURE_BYTES) break;
      used += img.data.length;
      figureUrl.set(img.id, `data:${img.mime};base64,${Buffer.from(img.data).toString("base64")}`);
    }
    const byId = new Map(problems.map((p) => [p.id, p]));
    const items = (ws?.items ?? []).map((it) => {
      const p = it.mathProblemId ? byId.get(it.mathProblemId) : undefined;
      const figure = p?.figureImageId ? figureUrl.get(p.figureImageId) ?? null : null;
      return {
        itemId: it.id,
        number: it.number,
        points: it.points,
        choicesCount: it.choicesCount,
        problemLatex: p ? (p.figureImageId ? stripFigurePlaceholder(p.problemLatex) : p.problemLatex) : null,
        figure,
      };
    });
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
      const parsed = (
        JSON.parse(item.question.choices) as {
          label: string;
          text: string;
          isCorrect?: boolean;
        }[]
      ).map((c) => ({ label: c.label, text: c.text, isCorrect: !!c.isCorrect }));
      // 마커전용 선지(어법/어휘/삽입 등)는 ①→⑤ 순서로 정렬·정리
      choices = normalizeMarkerChoices(parsed).map((c) => ({
        label: c.label,
        text: c.text,
      }));
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
