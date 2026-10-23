import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // PDF 렌더 테스트는 폰트 로딩·레이아웃 때문에 수십 초 걸릴 수 있음
    testTimeout: 180_000,
  },
});
