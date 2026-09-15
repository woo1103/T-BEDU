import type { Student } from "../lib/api";

interface Props {
  student: Student;
  onLogout: () => void;
}

export default function Home({ student, onLogout }: Props) {
  const enrolled = student.status === "enrolled";
  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/15 font-serif text-sm font-bold flex items-center justify-center">
            T&amp;B
          </div>
          <span className="font-semibold">T&amp;BEDU 학습</span>
        </div>
        <button onClick={onLogout} className="text-sm text-white/80 underline">
          로그아웃
        </button>
      </header>

      <main className="p-5 max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">환영합니다</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{student.name} 님</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">{student.grade}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                enrolled
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {enrolled ? "재원생" : "체험(비재원생)"}
            </span>
          </div>
        </div>

        {!enrolled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            반 코드로 가입하면 재원생 전용 학습(문제 풀이·성취도·영상)을 이용할 수 있어요.
            선생님께 반 코드를 받아 프로필에서 등록하세요.
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm text-center text-gray-400 text-sm">
          학습 기능(문제 풀이·성취도·영상)은 다음 단계에서 추가됩니다.
        </div>
      </main>
    </div>
  );
}
