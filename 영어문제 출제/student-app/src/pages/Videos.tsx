import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { getVideos, updateWatchProgress, type StudentVideo } from "../lib/api";

const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  etc: "기타",
};

// 유튜브 URL에서 영상 ID 추출 (watch/youtu.be/embed/shorts 지원)
function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

// YouTube IFrame API 1회 로드
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// 유튜브 임베드 재생 + 진도 자동 저장
function YouTubeMedia({ video }: { video: StudentVideo }) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const videoId = parseYouTubeId(video.url);
  const resumeAt = video.progress?.positionSec ?? 0;

  useEffect(() => {
    if (!videoId) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let destroyed = false;

    const save = (completed?: boolean) => {
      const p = playerRef.current;
      if (!p?.getDuration) return;
      const dur = p.getDuration() || 0;
      const cur = p.getCurrentTime() || 0;
      const percent = dur ? Math.round((cur / dur) * 100) : 0;
      updateWatchProgress(video.id, {
        positionSec: Math.floor(cur),
        percent,
        completed,
      });
    };

    loadYouTubeApi().then(() => {
      if (destroyed || !mountRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (resumeAt > 0) playerRef.current.seekTo(resumeAt, true);
            interval = setInterval(() => {
              const p = playerRef.current;
              // 1 = PLAYING
              if (p?.getPlayerState && p.getPlayerState() === 1) save();
            }, 8000);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            if (e.data === 2) save(); // PAUSED
            else if (e.data === 0) save(true); // ENDED
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (interval) clearInterval(interval);
      save();
      const p = playerRef.current;
      if (p?.destroy) p.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  if (!videoId) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center text-gray-400 text-sm">
        유효하지 않은 유튜브 링크입니다.
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}

// mp4 / HLS(.m3u8) 파일 재생 + 진도 자동 저장
function FileMedia({ video }: { video: StudentVideo }) {
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
    <video
      ref={ref}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      playsInline
      className="w-full bg-black"
    />
  );
}

function Player({ video, onBack }: { video: StudentVideo; onBack: () => void }) {
  const isYouTube =
    video.provider === "youtube" || parseYouTubeId(video.url) !== null;

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-[#245B3E] text-white px-5 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-white/80 text-lg leading-none">
          ‹
        </button>
        <span className="font-semibold truncate">{video.title}</span>
      </header>
      {isYouTube ? <YouTubeMedia video={video} /> : <FileMedia video={video} />}
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
