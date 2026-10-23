import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";

// DB에 저장한 수학 문제 그림 제공. 이미지는 한 번 저장되면 바뀌지 않으므로(교체 시 새 id) 오래 캐시해도 된다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  if (!staff) return new Response("권한 없음", { status: 403 });
  const { id } = await params;
  const img = await prisma.mathImage.findUnique({ where: { id }, select: { data: true, mime: true } });
  if (!img) return new Response("없음", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
