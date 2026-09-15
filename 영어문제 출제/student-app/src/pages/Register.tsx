import { useState, type FormEvent } from "react";
import { register, saveSession, type Student } from "../lib/api";

interface Props {
  onSuccess: (s: Student) => void;
  goLogin: () => void;
}

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];

export default function Register({ onSuccess, goLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("고1");
  const [classCode, setClassCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 6) {
      setErr("비밀번호는 6자 이상이어야 합니다");
      return;
    }
    setLoading(true);
    try {
      const { token, student } = await register({
        username: username.trim(),
        password,
        name: name.trim(),
        grade,
        classCode: classCode.trim() || undefined,
      });
      saveSession(token, student);
      onSuccess(student);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "회원가입에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 bg-[#f4f6f5]">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="text-sm text-gray-500 mt-1">
            반 코드가 있으면 입력하세요 (재원생). 없으면 비워두면 체험 계정으로 가입됩니다.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#245B3E] focus:border-[#245B3E] outline-none"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            autoCapitalize="none"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#245B3E] focus:border-[#245B3E] outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#245B3E] focus:border-[#245B3E] outline-none"
          />
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-[#245B3E] focus:border-[#245B3E] outline-none"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.toUpperCase())}
            placeholder="반 코드 (선택)"
            autoCapitalize="characters"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono tracking-wider focus:ring-2 focus:ring-[#245B3E] focus:border-[#245B3E] outline-none"
          />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#245B3E] text-white font-medium text-sm disabled:opacity-50"
          >
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          이미 계정이 있으신가요?{" "}
          <button onClick={goLogin} className="text-[#245B3E] font-medium underline">
            로그인
          </button>
        </p>
      </div>
    </div>
  );
}
