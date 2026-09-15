import { useState, type FormEvent } from "react";
import { login, saveSession, type Student } from "../lib/api";

interface Props {
  onSuccess: (s: Student) => void;
  goRegister: () => void;
}

export default function Login({ onSuccess, goRegister }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { token, student } = await login(username.trim(), password);
      saveSession(token, student);
      onSuccess(student);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-[#f4f6f5]">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#245B3E] text-white font-serif text-xl font-bold flex items-center justify-center mx-auto">
            T&amp;B
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">T&amp;BEDU 학습</h1>
          <p className="text-sm text-gray-500 mt-1">로그인</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
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
            placeholder="비밀번호"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#245B3E] focus:border-[#245B3E] outline-none"
          />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#245B3E] text-white font-medium text-sm disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          계정이 없으신가요?{" "}
          <button onClick={goRegister} className="text-[#245B3E] font-medium underline">
            회원가입
          </button>
        </p>
      </div>
    </div>
  );
}
