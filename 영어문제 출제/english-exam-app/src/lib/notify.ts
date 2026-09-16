import { prisma } from "@/lib/db";

// 반의 활성 재원생들에게 알림 생성. 반환: 수신자 수.
export async function notifyClassStudents(
  classId: string,
  n: { type: string; title: string; body?: string; linkUrl?: string }
): Promise<number> {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "active" },
    include: { student: { select: { userId: true } } },
  });
  const userIds = [...new Set(enrollments.map((e) => e.student.userId))];
  if (userIds.length === 0) return 0;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: n.type,
      title: n.title,
      body: n.body || null,
      linkUrl: n.linkUrl || null,
    })),
  });
  return userIds.length;
}
