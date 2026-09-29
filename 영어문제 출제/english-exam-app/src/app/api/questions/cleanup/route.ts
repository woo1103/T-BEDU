import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { validateStoredQuestion, isMarkerMappedType } from "@/lib/question-validate";

// 구조가 깨진 문항(어법/순서/삽입 마커·선지·정답 불일치)을 스캔한다.
async function scanBroken() {
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      questionType: true,
      passage: true,
      choices: true,
      answer: true,
      question: true,
    },
  });
  const broken: {
    id: string;
    questionType: string;
    reason: string;
    question: string;
    inExams: number;
  }[] = [];
  for (const q of questions) {
    if (!isMarkerMappedType(q.questionType)) continue;
    const v = validateStoredQuestion(q);
    if (!v.ok) {
      const inExams = await prisma.examItem.count({ where: { questionId: q.id } });
      broken.push({
        id: q.id,
        questionType: q.questionType,
        reason: v.reason ?? "구조 오류",
        question: q.question.slice(0, 60),
        inExams,
      });
    }
  }
  return broken;
}

// 검사(삭제 안 함): 깨진 문항 목록/개수
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const broken = await scanBroken();
  return NextResponse.json({ count: broken.length, broken });
}

// 정리(삭제): 깨진 문항을 삭제. 시험지에 배치된 것은 배치(ExamItem) 제거 후 삭제.
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "confirm 필요" }, { status: 400 });
  }

  const broken = await scanBroken();
  const ids = broken.map((b) => b.id);
  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0, removedFromExams: 0 });
  }

  const removedFromExams = await prisma.examItem.deleteMany({
    where: { questionId: { in: ids } },
  });
  // 오답노트/제출 답안은 refId로만 참조(FK 아님)하므로 문항 삭제에 영향 없음
  const deleted = await prisma.question.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    deleted: deleted.count,
    removedFromExams: removedFromExams.count,
  });
}
