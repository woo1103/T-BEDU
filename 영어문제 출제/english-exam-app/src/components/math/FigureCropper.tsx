"use client";

import { useEffect, useRef, useState } from "react";

// 원본 문제 이미지 위에서 드래그로 그림 영역을 골라 다시 자르기(또는 새로 넣기)
export default function FigureCropper({
  problemId,
  cropImageId,
  onClose,
  onSaved,
}: {
  problemId: string;
  cropImageId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 화면 좌표 → 이미지 안 비율(0~1)
  function toRatio(e: React.PointerEvent) {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!rect || !imgRef.current) return;
    const img = imgRef.current;
    const x0 = Math.min(rect.x0, rect.x1) * img.naturalWidth;
    const y0 = Math.min(rect.y0, rect.y1) * img.naturalHeight;
    const w = Math.abs(rect.x1 - rect.x0) * img.naturalWidth;
    const h = Math.abs(rect.y1 - rect.y0) * img.naturalHeight;
    if (w < 10 || h < 10) return setError("영역을 조금 더 크게 잡아 주세요.");
    setSaving(true);
    setError("");
    try {
      const c = document.createElement("canvas");
      c.width = Math.round(w);
      c.height = Math.round(h);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, x0, y0, w, h, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.9);
      const res = await fetch(`/api/math-problems/${problemId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figure: { base64: url.slice(url.indexOf(",") + 1), mime: "image/jpeg", width: c.width, height: c.height },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  const box = rect && {
    left: `${Math.min(rect.x0, rect.x1) * 100}%`,
    top: `${Math.min(rect.y0, rect.y1) * 100}%`,
    width: `${Math.abs(rect.x1 - rect.x0) * 100}%`,
    height: `${Math.abs(rect.y1 - rect.y0) * 100}%`,
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="그림 다시 자르기"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">그림 다시 자르기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600">원본에서 그림·그래프·표가 들어가도록 마우스로 끌어 네모를 그리세요.</p>
        <div className="relative inline-block select-none touch-none cursor-crosshair border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={`/api/math-images/${cropImageId}`}
            alt="원본 문제"
            draggable={false}
            className="block max-w-full max-h-[60vh]"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              const p = toRatio(e);
              setDrag(p);
              setRect({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = toRatio(e);
              setRect({ x0: drag.x, y0: drag.y, x1: p.x, y1: p.y });
            }}
            onPointerUp={() => setDrag(null)}
          />
          {box && <div className="absolute border-2 border-emerald-600 bg-emerald-400/15 pointer-events-none" style={box} />}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            취소
          </button>
          <button
            onClick={save}
            disabled={!rect || saving}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "이 영역을 그림으로 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
