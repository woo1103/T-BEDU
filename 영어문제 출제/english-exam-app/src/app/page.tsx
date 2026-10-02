import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 담당자 대시보드: 내 담당반별 미제출·미시청 요약
async function TeacherSummary({ teacherId }: { teacherId: string }) {
  const classes = await prisma.class.findMany({
    where: { teacherId, active: true },
    include: {
      enrollments: { where: { status: "active" }, select: { studentId: true } },
      assignments: {
        where: { active: true },
        select: { id: true, submissions: { select: { studentId: true } } },
      },
      videoAssignments: { select: { videoId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 시청 진도 일괄 조회
  const allVideoIds = [...new Set(classes.flatMap((c) => c.videoAssignments.map((v) => v.videoId)))];
  const allStudentIds = [...new Set(classes.flatMap((c) => c.enrollments.map((e) => e.studentId)))];
  const progress =
    allVideoIds.length && allStudentIds.length
      ? await prisma.watchProgress.findMany({
          where: { videoId: { in: allVideoIds }, studentId: { in: allStudentIds }, percent: { gt: 0 } },
          select: { videoId: true, studentId: true },
        })
      : [];
  const watchedSet = new Set(progress.map((p) => `${p.videoId}::${p.studentId}`));

  const rows = classes.map((c) => {
    const studentIds = c.enrollments.map((e) => e.studentId);
    let missing = 0;
    for (const a of c.assignments) {
      const submitted = new Set(a.submissions.map((s) => s.studentId));
      missing += studentIds.filter((id) => !submitted.has(id)).length;
    }
    let unwatched = 0;
    for (const v of c.videoAssignments) {
      unwatched += studentIds.filter((id) => !watchedSet.has(`${v.videoId}::${id}`)).length;
    }
    return {
      id: c.id,
      name: c.name,
      students: studentIds.length,
      assignments: c.assignments.length,
      videos: c.videoAssignments.length,
      missing,
      unwatched,
    };
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">내 담당반</h3>
        <Link href="/admin/status" className="text-sm text-blue-600 hover:text-blue-700">
          현황판 ›
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">담당 배정된 반이 없습니다. 관리자에게 반 배정을 요청하세요.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <span className="font-medium text-gray-800">{r.name}</span>
                <span className="text-xs text-gray-400 ml-2">학생 {r.students}명</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {r.missing > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    과제 미제출 {r.missing}건
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">과제 완료</span>
                )}
                {r.unwatched > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    영상 미시청 {r.unwatched}건
                  </span>
                )}
                <Link href="/admin/status" className="text-blue-600 hover:underline">
                  상세
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 관리자: 담당자 미지정 반 알림 (담당자 지정 돕기)
async function AdminUnassigned() {
  // 담당자(교사)가 지정되지 않은 반: teacherId 없음 또는 담당이 관리자 계정
  const unassigned = await prisma.class.findMany({
    where: {
      active: true,
      OR: [{ teacherId: null }, { teacher: { role: "admin" } }],
    },
    select: { id: true, name: true, center: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (unassigned.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-amber-800">담당자 미지정 반 {unassigned.length}개</p>
          <p className="text-sm text-amber-700 mt-0.5">
            담당자를 지정해야 해당 교사가 그 반을 볼 수 있어요:{" "}
            {unassigned.slice(0, 6).map((c) => `${c.center.name} ${c.name}`).join(", ")}
            {unassigned.length > 6 && " 외"}
          </p>
        </div>
        <Link
          href="/classes"
          className="shrink-0 px-4 py-2 bg-[#245B3E] text-white text-sm rounded-lg"
        >
          반 편성에서 지정 ›
        </Link>
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const user = await getCurrentUser();
  const questionCount = await prisma.question.count();
  const examCount = await prisma.exam.count();
  const aiQuestionCount = await prisma.question.count({
    where: { aiGenerated: true },
  });
  const recentQuestions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      {/* 역할별 요약 */}
      {user?.role === "admin" && <AdminUnassigned />}
      {user?.role === "teacher" && user.sub && (
        <TeacherSummary teacherId={user.sub} />
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm text-gray-500">총 문제 수</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {questionCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            AI 생성: {aiQuestionCount}개
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm text-gray-500">시험지 수</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{examCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm text-gray-500">빠른 시작</p>
          <div className="flex gap-2 mt-3">
            <Link
              href="/questions/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              문제 만들기
            </Link>
            <Link
              href="/exams/new"
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
            >
              시험지 구성
            </Link>
          </div>
        </div>
      </div>

      {/* 최근 문제 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">최근 문제</h3>
            <Link
              href="/questions"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              전체 보기
            </Link>
          </div>
        </div>
        {recentQuestions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">아직 문제가 없습니다</p>
            <p className="text-sm">
              <Link
                href="/questions/new"
                className="text-blue-600 hover:underline"
              >
                첫 문제를 만들어 보세요
              </Link>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentQuestions.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/questions/${q.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        q.aiGenerated
                          ? "bg-purple-50 text-purple-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {q.aiGenerated ? "AI" : "수동"}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {q.question.slice(0, 60)}
                      {q.question.length > 60 ? "..." : ""}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
