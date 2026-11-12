// 지우기 전에 "어디에 쓰이고 있는지"를 센다. 화면은 이 결과로 경고하거나 막는다.
import { prisma } from "@/lib/db";

export interface ExamUsage {
  assignments: number; // 이 시험지로 낸 과제 수
  classes: string[]; // 과제가 있는 반 이름
  submissions: number; // 학생 제출 수(있으면 삭제 금지)
}

export async function examUsage(examId: string): Promise<ExamUsage> {
  const asgs = await prisma.assignment.findMany({
    where: { assessment: { examId } },
    select: { id: true, class: { select: { name: true } }, _count: { select: { submissions: true } } },
  });
  return {
    assignments: asgs.length,
    classes: [...new Set(asgs.map((a) => a.class.name))],
    submissions: asgs.reduce((n, a) => n + a._count.submissions, 0),
  };
}

export interface QuestionUsage {
  exams: { id: string; title: string }[]; // 이 문항이 들어간 시험지
  answers: number; // 학생이 답한 횟수
}

export async function questionUsage(questionId: string): Promise<QuestionUsage> {
  const [items, answers] = await Promise.all([
    prisma.examItem.findMany({ where: { questionId }, select: { exam: { select: { id: true, title: true } } } }),
    prisma.answer.count({ where: { refType: "question", refId: questionId } }),
  ]);
  const seen = new Map(items.map((i) => [i.exam.id, i.exam]));
  return { exams: [...seen.values()], answers };
}

// 사람이 읽는 한 줄: "2개 반에 배정, 5명 제출" 같은 식
export function describeExamUsage(u: ExamUsage): string {
  if (u.assignments === 0) return "";
  const cls = u.classes.length ? `(${u.classes.join(", ")})` : "";
  return `${u.assignments}개 과제${cls}에 쓰이고 있고, 학생 ${u.submissions}명이 제출했어요.`;
}
