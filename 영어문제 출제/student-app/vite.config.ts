import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// 학생 PWA. 백엔드(기존 Next 앱)의 /api/auth/student, /api/student 를 토큰으로 호출.
// API 주소는 VITE_API_BASE 로 주입(미설정 시 로컬 백엔드).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "T&BEDU 학습",
        short_name: "T&BEDU",
        description: "T&BEDU 학생 학습 앱",
        lang: "ko",
        theme_color: "#245B3E",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        // 아이콘(pwa-192.png / pwa-512.png)은 로고 확정 후 public/ 에 추가 예정
        icons: [],
      },
    }),
  ],
  server: { port: 5173 },
});
