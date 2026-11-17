import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { deleteMathProblems } from "@/lib/math-problem-delete";

// 수학 은행 문제 여러 개 한꺼번에 삭제. body: { ids: string[] }
// 학습지에 쓰인 문제는 남기고 kept로 알려 준다.
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const ids: unknown = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "지울 문제를 골라 주세요" }, { status: 400 });
  }
  if (ids.length > 1000) return NextResponse.json({ error: "한 번에 1000개까지 지울 수 있어요" }, { status: 400 });
  return NextResponse.json(await deleteMathProblems(ids as string[]));
}
