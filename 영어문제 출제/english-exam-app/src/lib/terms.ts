import { prisma } from "./db";

// 현재 학년도 id (없으면 null)
export async function getCurrentTermId(): Promise<string | null> {
  const t = await prisma.academicTerm.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  return t?.id ?? null;
}
