import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("teb_install_dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("teb_install_dismissed", "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3">
      <div className="max-w-md mx-auto bg-[#245B3E] text-white rounded-2xl p-4 shadow-lg flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">앱으로 설치하기</p>
          <p className="text-xs text-white/80">
            홈 화면에 추가하면 앱처럼 빠르게 이용할 수 있어요.
          </p>
        </div>
        <button
          onClick={install}
          className="bg-white text-[#245B3E] text-sm font-medium px-3 py-1.5 rounded-lg"
        >
          설치
        </button>
        <button onClick={dismiss} className="text-white/70 text-lg leading-none">
          ✕
        </button>
      </div>
    </div>
  );
}
