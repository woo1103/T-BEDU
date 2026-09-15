import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

const DEFAULT_CENTERS = ["청명", "서천"];

async function ensureCenters() {
  const count = await prisma.center.count();
  if (count > 0) return;
  for (const name of DEFAULT_CENTERS) {
    await prisma.center.create({ data: { name } }).catch(() => {});
  }
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  await ensureCenters();
  const centers = await prisma.center.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ centers });
}
