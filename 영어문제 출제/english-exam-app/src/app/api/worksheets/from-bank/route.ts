import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { detectChoicesCount, normalizeAnswer } from "@/lib/math-worksheet";

// 수학 문제은행에서 고른 문제로 학습지(Worksheet) 만들기.
// body: { title, grade?, items: [{ mathProblemId, answer }] } — 순서대로 1번부터.
// 만든 학습지는 기존 반·개인 배정과 자동 채점(정답키)을 그대로 쓴다.
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    grade?: string;
    items?: { mathProblemId?: string; answer?: string }[];
  } | null;
  const title = body?.title?.trim();
  const items = Array.isArray(body?.items) ? body!.items : [];
  if (!title || items.length === 0) {
    return NextResponse.json({ error: "제목과 문제가 필요합니다" }, { status: 400 });
  }
  if (items.length > 200) return NextResponse.json({ error: "한 학습지는 200문제까지예요" }, { status: 400 });
  if (items.some((it) => !it.mathProblemId || !String(it.answer ?? "").trim())) {
    return NextResponse.json({ error: "모든 문제에 정답이 있어야 해요(채점에 필요)" }, { status: 400 });
  }

  const ids = items.map((it) => it.mathProblemId!);
  const problems = await prisma.mathProblem.findMany({
    where: { id: { in: ids } },
    select: { id: true, problemLatex: true, source: true },
  });
  const byId = new Map(problems.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ error: `없는 문제가 ${missing.length}개 있어요(삭제됐을 수 있음)` }, { status: 400 });
  }

  const sources = [...new Set(problems.map((p) => p.source).filter(Boolean))];
  const worksheet = await prisma.worksheet.create({
    data: {
      subject: "math",
      title,
      grade: body?.grade?.trim() || null,
      source: sources.length === 1 ? sources[0] : sources.length > 1 ? "문제은행(여러 출처)" : "문제은행",
      itemCount: items.length,
      items: {
        create: items.map((it, i) => {
          const latex = byId.get(it.mathProblemId!)!.problemLatex;
          const choicesCount = detectChoicesCount(latex);
          return {
            number: i + 1,
            // 선생님이 확인·입력한 값: 1~5는 선지 번호로(값 3이 ⑤ 선지 내용이어도 ③)
            answer: normalizeAnswer(String(it.answer), choicesCount),
            points: 1,
            choicesCount,
            mathProblemId: it.mathProblemId!,
          };
        }),
      },
    },
    select: { id: true, title: true },
  });

  return NextResponse.json({ worksheet }, { status: 201 });
}
