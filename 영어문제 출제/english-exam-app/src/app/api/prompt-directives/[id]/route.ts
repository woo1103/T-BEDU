import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const updated = await prisma.promptDirective.update({
    where: { id },
    data: {
      title: body.title,
      body: body.body,
      scope: body.scope,
      scopeKey: body.scope === "global" ? null : body.scopeKey,
      enabled: body.enabled,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.promptDirective.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
