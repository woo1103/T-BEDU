/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// 새 배포가 앱을 켜는 즉시 반영되도록: 새 SW가 대기하지 않고 바로 활성화 + 제어권 인계,
// 그리고 이미 열린 화면(예전 버전)을 새로 고친다. 처음 설치할 때는 새로 고치지 않는다.
let isUpdate = false;
self.addEventListener("install", () => {
  isUpdate = !!self.registration.active;
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  const claimed = self.clients.claim();
  event.waitUntil(claimed);
  // 새로 고침은 waitUntil에 넣지 않는다: 활성화가 끝나야 새 화면 요청이 처리되므로, 기다리면 서로 멈춘다
  if (!isUpdate) return;
  claimed
    .then(() => self.clients.matchAll({ type: "window" }))
    .then((windows) => Promise.all(windows.map((w) => w.navigate(w.url).catch(() => null))))
    .catch(() => null);
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "T&BEDU 학습", {
      body: data.body || "",
      icon: "/pwa-icon.svg",
      badge: "/pwa-icon.svg",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
