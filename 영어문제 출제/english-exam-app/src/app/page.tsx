import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function Dashboard() {
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
