import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { getVideos, updateWatchProgress, type StudentVideo } from "../lib/api";

const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  etc: "기타",
};

function Player({ video, onBack }: { video: StudentVideo; onBack: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hls: Hls | null = null;
    const isHls = video.url.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(video.url);
      hls.attachMedia(el);
    } else {
      el.src = video.url; // mp4 또는 Safari 네이티브 HLS
    }

    const resumeAt = video.progress?.positionSec ?? 0;
    const onLoaded = () => {
      if (resumeAt > 0 && resumeAt < (el.duration || Infinity)) {
        el.currentTime = resumeAt;
      }
    };
    const save = (completed?: boolean) => {
      const dur = el.duration || 0;
      const percent = dur ? Math.round((el.currentTime / dur) * 100) : 0;
      updateWatchProgress(video.id, {
        positionSec: Math.floor(el.currentTime),
        percent,
        completed,
      });
    };
    const onTime = () => {
      const now = Date.now();
      if (now - lastSaved.current > 8000) {
        lastSaved.current = now;
        save();
      }
    };
    const onPause = () => save();
    const onEnded = () => save(true);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      save();
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      if (hls) hls.destroy();
    };
  }, [video.id, video.url, video.progress?.positionSec]);

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-white/80 text-lg leading-none">
          ‹
        </button>
        <span className="font-semibold truncate">{video.title}</span>
      </header>
      <video
        ref={ref}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        playsInline
        className="w-full bg-black"
      />
      {video.description && (
        <p className="text-sm text-gray-300 p-4">{video.description}</p>
      )}
      <p className="text-[11px] text-gray-500 px-4 pb-6">
        시청 위치는 자동 저장됩니다.
      </p>
    </div>
  );
}

export default function Videos({ onDone }: { onDone: () => void }) {
  const [videos, setVideos] = useState<StudentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentVideo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await getVideos();
        setVideos(d.videos);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (selected) {
    return <Player video={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5] pb-10">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onDone} className="text-white/80 text-lg leading-none">
          ‹
        </button>
        <span className="font-semibold">영상 강의</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            불러오는 중...
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
            시청할 영상이 없습니다.
          </div>
        ) : (
          videos.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {SUBJECT_LABEL[v.subject] || v.subject}
                </span>
                <p className="font-medium text-gray-800 truncate flex-1">{v.title}</p>
                {v.progress?.completed && (
                  <span className="text-xs text-green-600">완료</span>
                )}
              </div>
              <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-[#245B3E] h-1.5 rounded-full"
                  style={{ width: `${v.progress?.percent ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                진도 {v.progress?.percent ?? 0}%
              </p>
            </button>
          ))
        )}
      </main>
    </div>
  );
}
