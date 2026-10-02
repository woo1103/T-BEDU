import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff, isAdmin, canAccessClass } from "@/lib/api-auth";
import { getQuestionTypeInfo } from "@/lib/question-types";

// 정답률 낮은 문항 리포트. GET ?classId=(선택)&limit=
export async function GET(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const limit = Number(url.searchParams.get("limit")) || 20;

  if (classId && !(await canAccessClass(staff, classId))) {
    return NextResponse.json({ error: "담당 반이 아닙니다" }, { status: 403 });
  }

  // 답안 범위: 특정 반 지정 시 그 반, 아니면 담당자는 본인 담당반 전체(관리자는 전부)
  const answerWhere = classId
    ? { submission: { assignment: { classId } } }
    : isAdmin(staff)
    ? {}
    : { submission: { assignment: { class: { teacherId: staff.sub } } } };
  const answers = await prisma.answer.findMany({
    where: answerWhere,
    select: { refId: true, refType: true, isCorrect: true },
  });

  // refId별 집계
  const agg = new Map<string, { refType: string; total: number; correct: number }>();
  for (const a of answers) {
    const cur = agg.get(a.refId) ?? { refType: a.refType, total: 0, correct: 0 };
    cur.total++;
    if (a.isCorrect) cur.correct++;
    agg.set(a.refId, cur);
  }

  const qIds = [...agg.entries()].filter(([, v]) => v.refType === "question").map(([k]) => k);
  const wIds = [...agg.entries()].filter(([, v]) => v.refType === "worksheet_item").map(([k]) => k);

  const questions = await prisma.question.findMany({
    where: { id: { in: qIds } },
    select: { id: true, question: true, examType: true, questionType: true },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const wItems = await prisma.worksheetItem.findMany({
    where: { id: { in: wIds } },
    select: { id: true, number: true, worksheet: { select: { title: true } } },
  });
  const wMap = new Map(wItems.map((w) => [w.id, w]));

  const rows = [...agg.entries()]
    .filter(([, v]) => v.total >= 1)
    .map(([refId, v]) => {
      let label = "문항";
      let subject = "english";
      if (v.refType === "question") {
        const q = qMap.get(refId);
        const ti = q ? getQuestionTypeInfo(q.examType, q.questionType) : null;
        label = q ? (ti ? `${ti.name} · ${q.question}` : q.question) : "삭제된 문항";
      } else {
        const w = wMap.get(refId);
        label = w ? `${w.worksheet.title} ${w.number}번` : "삭제된 문항";
        subject = "math";
      }
      return {
        refId,
        refType: v.refType,
        subject,
        label: label.slice(0, 80),
        total: v.total,
        correct: v.correct,
        rate: Math.round((v.correct / v.total) * 100),
      };
    })
    .sort((a, b) => a.rate - b.rate)
    .slice(0, limit);

  return NextResponse.json({ items: rows });
}
