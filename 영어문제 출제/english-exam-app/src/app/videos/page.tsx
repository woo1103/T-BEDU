"use client";

import { useEffect, useState } from "react";
import SourceTree from "@/components/SourceTree";

interface VideoRow {
  id: string;
  subject: string;
  grade: string | null;
  source: string | null;
  title: string;
  url: string;
  _count: { assignments: number; watchProgress: number };
}
interface ClassRow {
  id: string;
  name: string;
  grade?: string | null;
  center: { name: string };
}

const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  etc: "기타",
};
const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 등록 폼
  const [subject, setSubject] = useState("english");
  const [grade, setGrade] = useState("");
  const [source, setSource] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // 필터 + 선택
  const [filterSubject, setFilterSubject] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 배정 모달
  const [assignVideoIds, setAssignVideoIds] = useState<string[]>([]);
  const [assignClassIds, setAssignClassIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  async function load() {
    const [vRes, cRes] = await Promise.all([
      fetch("/api/videos"),
      fetch("/api/classes"),
    ]);
    setVideos((await vRes.json()).videos || []);
    setClasses((await cRes.json()).classes || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!title.trim() || !url.trim()) {
      alert("제목과 재생 URL을 입력하세요.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, grade: grade || undefined, source: source || undefined, title, url, description }),
    });
    setSaving(false);
    if (!res.ok) {
      alert((await res.json()).error || "저장 실패");
      return;
    }
    setTitle("");
    setUrl("");
    setDescription("");
    await load();
  }

  async function uploadFile() {
    if (!title.trim() || !file) {
      alert("제목과 업로드할 영상 파일을 선택하세요.");
      return;
    }
    setUploading(true);
    try {
      const ctype = file.type || "video/mp4";
      const u = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: ctype }),
      });
      if (!u.ok) throw new Error((await u.json()).error || "업로드 URL 발급 실패");
      const { uploadUrl, key } = await u.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": ctype },
        body: file,
      });
      if (!put.ok) throw new Error("R2 업로드 실패");

      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, grade: grade || undefined, source: source || undefined, title, description, provider: "r2", url: key }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "등록 실패");

      setTitle("");
      setDescription("");
      setFile(null);
      alert("업로드 및 등록 완료");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function remove(v: VideoRow) {
    if (!confirm("이 영상을 삭제할까요?")) return;
    const res = await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const filtered = videos.filter(
    (v) =>
      (!filterSubject || v.subject === filterSubject) &&
      (!filterGrade || v.grade === filterGrade)
  );
  const sourceOptions = [...new Set(videos.map((v) => v.source).filter(Boolean))] as string[];

  function toggleVideo(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    const ids = filtered.map((v) => v.id);
    const allOn = ids.every((id) => checked.has(id));
    setChecked((prev) => {
      const n = new Set(prev);
      if (allOn) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  }

  function openAssign(videoIds: string[]) {
    if (classes.length === 0) {
      alert("먼저 반을 만들어 주세요.");
      return;
    }
    setAssignVideoIds(videoIds);
    setAssignClassIds(new Set());
  }
  function toggleAssignClass(id: string) {
    setAssignClassIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  async function submitAssign() {
    if (assignClassIds.size === 0) {
      alert("노출할 반을 1개 이상 선택하세요.");
      return;
    }
    setAssigning(true);
    const res = await fetch("/api/videos/assign-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoIds: assignVideoIds,
        classIds: [...assignClassIds],
      }),
    });
    setAssigning(false);
    if (res.ok) {
      const r = await res.json();
      alert(`${r.created}건 노출 완료.`);
      setAssignVideoIds([]);
      setChecked(new Set());
      await load();
    } else {
      alert((await res.json()).error || "배정 실패");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">영상 강의</h2>
        <p className="text-sm text-gray-500 mt-1">
          유튜브 링크 또는 재생 URL(HLS .m3u8 / mp4)을 등록하고 반에 노출하면, 학생 앱에서
          시청·진도율이 기록됩니다. 여러 영상을 체크해 <b>여러 반에 한 번에</b> 노출할 수 있어요.
        </p>
      </div>

      {/* 등록 폼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800">새 영상 등록</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="english">영어</option>
            <option value="math">수학</option>
            <option value="etc">기타</option>
          </select>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">학년 전체</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            list="video-sources"
            placeholder="출처 (교과서/올림포스/모의고사 등)"
            className="col-span-2 md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <datalist id="video-sources">
            {sourceOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="영상 제목"
            className="col-span-2 md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="유튜브 링크 또는 재생 URL (.m3u8 / .mp4)"
            className="col-span-2 md:col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            className="col-span-2 md:col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={create}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? "저장 중..." : "URL로 등록"}
          </button>
        </div>

        {/* R2 파일 업로드 */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            또는 파일 업로드 (Cloudflare R2)
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <button
              onClick={uploadFile}
              disabled={uploading}
              className="px-5 py-2.5 bg-[#245B3E] text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {uploading ? "업로드 중..." : "파일 업로드 & 등록"}
            </button>
          </div>
        </div>
      </div>

      {/* 목록 + 필터 + 다중배정 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-800">
            등록된 영상 {loading ? "" : `(${filtered.length})`}
          </span>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="ml-auto border border-gray-300 rounded-lg px-2 py-1 text-xs"
          >
            <option value="">과목 전체</option>
            <option value="english">영어</option>
            <option value="math">수학</option>
            <option value="etc">기타</option>
          </select>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
          >
            <option value="">학년 전체</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* 다중 선택 바 */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 text-gray-600">
              <input
                type="checkbox"
                checked={filtered.every((v) => checked.has(v.id))}
                onChange={toggleAllVisible}
              />
              전체 선택
            </label>
            <span className="text-xs text-gray-400">{checked.size}개 선택됨</span>
            {checked.size > 0 && (
              <button
                onClick={() => openAssign([...checked])}
                className="ml-auto text-xs px-3 py-1.5 bg-[#245B3E] text-white rounded-lg"
              >
                선택 {checked.size}개 → 반에 노출
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">영상이 없습니다.</div>
        ) : (
          <SourceTree
            items={filtered}
            renderItem={(v) => (
              <div className="flex items-center gap-3 py-1.5">
                <input
                  type="checkbox"
                  checked={checked.has(v.id)}
                  onChange={() => toggleVideo(v.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 truncate text-sm">{v.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    노출 {v._count.assignments}개 반 · 시청 {v._count.watchProgress}명
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openAssign([v.id])}
                    className="text-xs px-3 py-1.5 bg-[#245B3E] text-white rounded-lg"
                  >
                    반 노출
                  </button>
                  <button
                    onClick={() => remove(v)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </div>

      {/* 반 배정 모달 (여러 반 동시) */}
      {assignVideoIds.length > 0 && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !assigning && setAssignVideoIds([])}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800">반에 노출</h3>
              <p className="text-sm text-gray-500 mt-1">
                영상 {assignVideoIds.length}개 → 선택한 반(들)에 한 번에 노출
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">반 선택</span>
              <button
                onClick={() =>
                  setAssignClassIds((prev) =>
                    prev.size === classes.length
                      ? new Set()
                      : new Set(classes.map((c) => c.id))
                  )
                }
                className="text-xs text-[#245B3E] hover:underline"
              >
                전체 선택/해제
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-2">
              {classes.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={assignClassIds.has(c.id)}
                    onChange={() => toggleAssignClass(c.id)}
                  />
                  <span className="text-gray-700">
                    {c.center.name} · {c.name}
                    {c.grade && <span className="text-gray-400"> ({c.grade})</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssignVideoIds([])}
                disabled={assigning}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={submitAssign}
                disabled={assigning || assignClassIds.size === 0}
                className="px-4 py-2 bg-[#245B3E] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {assigning ? "노출 중..." : `${assignClassIds.size}개 반에 노출`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
