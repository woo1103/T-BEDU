import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { cleanVocab, type VocabRow } from "@/lib/vocab";

// 단어 세트 목록(단어 수·배정된 반 포함)
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const sets = await prisma.vocabSet.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { words: true } },
      assignments: { select: { class: { select: { id: true, name: true } } } },
    },
  });
  return NextResponse.json(
    sets.map((s) => ({
      id: s.id,
      title: s.title,
      grade: s.grade,
      description: s.description,
      createdAt: s.createdAt,
      wordCount: s._count.words,
      classes: s.assignments.map((a) => a.class),
    }))
  );
}

// 새 세트. body: { title, grade?, description?, words: VocabRow[] }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "세트 이름을 적어 주세요" }, { status: 400 });
  const words = cleanVocab(Array.isArray(body?.words) ? (body.words as VocabRow[]) : []);
  if (words.length > 3000) return NextResponse.json({ error: "한 세트는 3000단어까지예요" }, { status: 400 });
  const set = await prisma.vocabSet.create({
    data: {
      title,
      grade: body?.grade ? String(body.grade).trim() || null : null,
      description: body?.description ? String(body.description).trim() || null : null,
      createdById: staff.sub,
      words: {
        create: words.map((w, i) => ({ order: i + 1, word: w.word, meaning: w.meaning, example: w.example ?? null })),
      },
    },
  });
  return NextResponse.json({ id: set.id }, { status: 201 });
}
