import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/api-auth";
import { notifyClassStudents } from "@/lib/notify";

// 여러 영상을 여러 반에 한 번에 노출(배정). body: { videoIds: [], classIds: [] }
export async function POST(request: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const videoIds: string[] = Array.isArray(body?.videoIds) ? body.videoIds : [];
  const classIds: string[] = Array.isArray(body?.classIds) ? body.classIds : [];
  if (videoIds.length === 0 || classIds.length === 0) {
    return NextResponse.json(
      { error: "영상과 반을 각각 1개 이상 선택하세요" },
      { status: 400 }
    );
  }

  // 이미 배정된 조합은 건너뛰기
  const existing = await prisma.videoAssignment.findMany({
    where: { videoId: { in: videoIds }, classId: { in: classIds } },
    select: { videoId: true, classId: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.videoId}::${e.classId}`));

  const toCreate: { videoId: string; classId: string }[] = [];
  for (const v of videoIds) {
    for (const c of classIds) {
      if (!existingSet.has(`${v}::${c}`)) toCreate.push({ videoId: v, classId: c });
    }
  }

  let created = 0;
  if (toCreate.length > 0) {
    const res = await prisma.videoAssignment.createMany({ data: toCreate });
    created = res.count;
  }

  // 반별로 1회 알림 (새로 노출된 반만)
  const notifiedClasses = new Set(toCreate.map((t) => t.classId));
  for (const classId of notifiedClasses) {
    await notifyClassStudents(classId, {
      type: "new_video",
      title: "새 영상 강의",
      body: `${videoIds.length}개 영상이 노출되었습니다`,
    }).catch(() => {});
  }

  return NextResponse.json({
    created,
    skipped: toCreate.length === 0 ? videoIds.length * classIds.length : 0,
  });
}
