import { getCurrentUser, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 교사/관리자 전용 API 가드. 권한 없으면 null → 핸들러에서 403 반환.
export async function requireStaff(): Promise<SessionPayload | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "teacher")) return null;
  return user;
}

export function isAdmin(user: SessionPayload): boolean {
  return user.role === "admin";
}

// 담당반 스코프 where절. 관리자는 전체({}), 담당자는 본인 담당반만.
export function classScopeWhere(user: SessionPayload): { teacherId?: string } {
  return user.role === "admin" ? {} : { teacherId: user.sub };
}

// 이 사용자가 특정 반에 접근 가능한가 (관리자 전체, 담당자는 본인 담당반).
export async function canAccessClass(
  user: SessionPayload,
  classId: string
): Promise<boolean> {
  if (user.role === "admin") return true;
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  return !!cls && cls.teacherId === user.sub;
}
