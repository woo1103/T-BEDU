import { getCurrentUser, type SessionPayload } from "@/lib/auth";

// 교사/관리자 전용 API 가드. 권한 없으면 null → 핸들러에서 403 반환.
export async function requireStaff(): Promise<SessionPayload | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "teacher")) return null;
  return user;
}
