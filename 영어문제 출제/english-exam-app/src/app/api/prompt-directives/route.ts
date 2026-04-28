import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const list = await prisma.promptDirective.findMany({
    orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }
  const body = await request.json();
  if (!body.title || !body.body || !body.scope) {
    return NextResponse.json({ error: "title, body, scope는 필수입니다" }, { status: 400 });
  }
  if (!["global", "examType", "questionType"].includes(body.scope)) {
    return NextResponse.json({ error: "scope 값이 올바르지 않습니다" }, { status: 400 });
  }
  if (body.scope !== "global" && !body.scopeKey) {
    return NextResponse.json(
      { error: "examType/questionType scope에는 scopeKey가 필요합니다" },
      { status: 400 }
    );
  }
  const created = await prisma.promptDirective.create({
    data: {
      title: body.title,
      body: body.body,
      scope: body.scope,
      scopeKey: body.scope === "global" ? null : body.scopeKey,
      enabled: body.enabled ?? true,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
