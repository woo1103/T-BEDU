import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { cleanVocab, type VocabRow } from "@/lib/vocab";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const set = await prisma.vocabSet.findUnique({
    where: { id },
    include: {
      words: { orderBy: { order: "asc" } },
      assignments: { select: { classId: true } },
    },
  });
  if (!set) return NextResponse.json({ error: "세트를 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json({ ...set, classIds: set.assignments.map((a) => a.classId) });
}

// 세트 정보와 단어 목록 저장. 기존 단어(id 있음)는 고쳐 쓰고(학생 기록 유지), 목록에서 빠진 단어는 지운다.
export async function PUT(request: NextRequest, { params }: Ctx) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "세트 이름을 적어 주세요" }, { status: 400 });
  const words = cleanVocab(Array.isArray(body?.words) ? (body.words as VocabRow[]) : []);
  if (words.length > 3000) return NextResponse.json({ error: "한 세트는 3000단어까지예요" }, { status: 400 });

  const existing = await prisma.vocabWord.findMany({ where: { setId: id }, select: { id: true } });
  const existingIds = new Set(existing.map((w) => w.id));
  const keepIds = new Set(words.map((w) => w.id).filter((x): x is string => !!x && existingIds.has(x)));
  const removeIds = [...existingIds].filter((x) => !keepIds.has(x));

  await prisma.$transaction(
    async (tx) => {
      await tx.vocabSet.update({
        where: { id },
        data: {
          title,
          grade: body?.grade ? String(body.grade).trim() || null : null,
          description: body?.description ? String(body.description).trim() || null : null,
        },
      });
      if (removeIds.length) await tx.vocabWord.deleteMany({ where: { id: { in: removeIds } } });
      const fresh: { setId: string; order: number; part: number; word: string; meaning: string; example: string | null }[] = [];
      for (const [i, w] of words.entries()) {
        const data = { order: i + 1, part: w.part ?? 1, word: w.word, meaning: w.meaning, example: w.example ?? null };
        if (w.id && keepIds.has(w.id)) await tx.vocabWord.update({ where: { id: w.id }, data });
        else fresh.push({ ...data, setId: id });
      }
      if (fresh.length) await tx.vocabWord.createMany({ data: fresh });
    },
    { timeout: 60_000 }
  );
  return NextResponse.json({ ok: true, count: words.length });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await params;
  await prisma.vocabSet.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
