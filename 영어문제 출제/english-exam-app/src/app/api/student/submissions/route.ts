import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentFromRequest } from "@/lib/student-auth";
import { correctLabel } from "@/lib/grading";
import { gradeWritingAnswer } from "@/lib/claude";
import { areaNamesForAnswers, computeBreakdown } from "@/lib/achievement";

interface AnswerRow {
  refType: string;
  refId: string;
  selected: string;
  isCorrect: boolean;
  points: number;
  feedback?: string | null;
}

// 서술형(주관식) 유형 판별
function isWritingType(questionType: string): boolean {
  return questionType.startsWith("naesin_writing");
}

// 학생 마킹 제출 → 자동 채점 (영어 시험지 / 수학 문제지 공통).
// body: { assignmentId, answers: [{questionId|refId, selected}] }
export async function POST(request: NextRequest) {
  const student = await getStudentFromRequest(request);
  if (!student) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: body.assignmentId },
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

  // 학생 답: refId 또는 questionId 키 모두 허용
  const selectedByRef = new Map<string, string>();
  for (const a of body.answers) {
    const key =
      typeof a?.refId === "string"
        ? a.refId
        : typeof a?.questionId === "string"
        ? a.questionId
        : null;
    if (key && typeof a.selected === "string" && !selectedByRef.has(key)) {
      selectedByRef.set(key, a.selected);
    }
  }

  let score = 0;
  let totalPoints = 0;
  let correctCount = 0;
  const answerRows: AnswerRow[] = [];
  const writingResults: {
    questionId: string;
    orderNum: number;
    awarded: number;
    points: number;
    feedback: string;
  }[] = [];

  if (assignment.assessment.type === "worksheet") {
    const items = assignment.assessment.worksheet?.items ?? [];
    for (const item of items) {
      const pts = item.points;
      totalPoints += pts;
      const selected = (selectedByRef.get(item.id) ?? "").trim();
      const isCorrect = selected !== "" && selected === item.answer.trim();
      if (isCorrect) {
        score += pts;
        correctCount++;
      }
      answerRows.push({
        refType: "worksheet_item",
        refId: item.id,
        selected,
        isCorrect,
        points: isCorrect ? pts : 0,
      });
    }
  } else {
    const items = assignment.assessment.exam?.items ?? [];
    for (const item of items) {
      const q = item.question;
      const pts = item.customPoints ?? q.points;
      totalPoints += pts;
      const selected = selectedByRef.get(q.id) ?? "";

      if (isWritingType(q.questionType)) {
        // 서술형: AI 자동 채점 (모범답안=answer, 채점기준=explanation)
        let awarded = 0;
        let feedback: string | null = null;
        if (selected.trim() === "") {
          feedback = "답안이 제출되지 않았습니다.";
        } else {
          try {
            const graded = await gradeWritingAnswer({
              question: q.question,
              passage: q.passage,
              modelAnswer: q.answer,
              rubric: q.explanation ?? undefined,
              studentAnswer: selected,
              maxPoints: pts,
            });
            awarded = graded.awardedPoints;
            feedback = graded.feedback;
          } catch {
            // AI 채점 실패 시 0점 처리하고 수동 확인 안내
            awarded = 0;
            feedback = "자동 채점에 실패했습니다. 담당 선생님의 확인이 필요합니다.";
          }
        }
        // 만점의 60% 이상이면 정답으로 간주(성취도/오답노트 기준)
        const isCorrect = pts > 0 && awarded >= Math.ceil(pts * 0.6);
        score += awarded;
        if (isCorrect) correctCount++;
        answerRows.push({
          refType: "question",
          refId: q.id,
          selected,
          isCorrect,
          points: awarded,
          feedback,
        });
        writingResults.push({
          questionId: q.id,
          orderNum: item.orderNum,
          awarded,
          points: pts,
          feedback: feedback ?? "",
        });
      } else {
        const correct = correctLabel(q);
        const isCorrect = !!correct && selected === correct;
        if (isCorrect) {
          score += pts;
          correctCount++;
        }
        answerRows.push({
          refType: "question",
          refId: q.id,
          selected,
          isCorrect,
          points: isCorrect ? pts : 0,
        });
      }
    }
  }

  const submission = await prisma.submission.create({
    data: {
      studentId: student.studentId,
      assignmentId: assignment.id,
      submittedAt: new Date(),
      status: "graded",
      score,
      totalPoints,
      correctCount,
      itemCount: answerRows.length,
      answers: { create: answerRows },
    },
  });

  // 성취도 스냅샷
  const areaMap = await areaNamesForAnswers(
    answerRows.map((r) => ({ refId: r.refId, refType: r.refType }))
  );
  const breakdown = computeBreakdown(
    answerRows.map((r) => ({ refId: r.refId, isCorrect: r.isCorrect })),
    areaMap
  );
  await prisma.achievementSnapshot.create({
    data: {
      studentId: student.studentId,
      submissionId: submission.id,
      subject: assignment.assessment.subject,
      overallRate: breakdown.overall.rate,
      byArea: JSON.stringify(breakdown.areas),
    },
  });

  // 오답노트 자동 생성
  const wrongAnswers = await prisma.answer.findMany({
    where: { submissionId: submission.id, isCorrect: false },
    select: { id: true },
  });
  if (wrongAnswers.length > 0) {
    await prisma.wrongNote.createMany({
      data: wrongAnswers.map((a) => ({
        studentId: student.studentId,
        answerId: a.id,
      })),
    });
  }

  return NextResponse.json(
    {
      submissionId: submission.id,
      score,
      totalPoints,
      correctCount,
      itemCount: answerRows.length,
      rate: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
      writingResults,
    },
    { status: 201 }
  );
}
