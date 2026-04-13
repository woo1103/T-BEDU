"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  role: "admin" | "teacher";
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"teacher" | "admin">("teacher");
  const [createError, setCreateError] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "teacher">("teacher");
  const [editError, setEditError] = useState("");

  async function load() {
    const [meRes, usersRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/users"),
    ]);
    if (!meRes.ok || !usersRes.ok) {
      router.push("/");
      return;
    }
    const meData = await meRes.json();
    const usersData = await usersRes.json();
    if (meData.user?.role !== "admin") {
      router.push("/");
      return;
    }
    setMe(meData.user);
    setUsers(usersData.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
    });
    if (!res.ok) {
      const d = await res.json();
      setCreateError(d.error || "생성 실패");
      return;
    }
    setNewUsername("");
    setNewPassword("");
    setNewRole("teacher");
    setShowCreate(false);
    load();
  }

  function startEdit(u: User) {
    setEditId(u.id);
    setEditUsername(u.username);
    setEditPassword("");
    setEditRole(u.role);
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditError("");
    const body: Record<string, string> = {};
    const orig = users.find((u) => u.id === editId);
    if (editUsername !== orig?.username) body.username = editUsername;
    if (editPassword) body.password = editPassword;
    if (editRole !== orig?.role) body.role = editRole;

    if (Object.keys(body).length === 0) {
      setEditId(null);
      return;
    }

    const res = await fetch(`/api/users/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setEditError(d.error || "수정 실패");
      return;
    }
    setEditId(null);
    load();
  }

  async function handleDelete(u: User) {
    if (!confirm(`"${u.username}" 계정을 삭제하시겠습니까?`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return <div className="p-8 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">계정 관리</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium"
        >
          {showCreate ? "취소" : "새 계정 추가"}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">아이디</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">역할</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "teacher" | "admin")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="teacher">담당자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
          {createError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{createError}</p>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
          >
            계정 생성
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">아이디</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">역할</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">생성일</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0">
                {editId === u.id ? (
                  <td colSpan={4} className="px-4 py-3">
                    <form onSubmit={handleEdit} className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">아이디</label>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            비밀번호 (빈칸이면 유지)
                          </label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="변경 시 입력"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">역할</label>
                          <select
                            value={editRole}
                            onChange={(e) =>
                              setEditRole(e.target.value as "admin" | "teacher")
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="teacher">담당자</option>
                            <option value="admin">관리자</option>
                          </select>
                        </div>
                      </div>
                      {editError && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
                          {editError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(null)}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                        >
                          취소
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 text-gray-800 font-medium">{u.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {u.role === "admin" ? "관리자" : "담당자"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => startEdit(u)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700"
                      >
                        수정
                      </button>
                      {u.id !== me?.id && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 rounded text-xs text-red-600"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center text-gray-400 py-8">등록된 계정이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
