/**
 * 새 PC에서 이 프로젝트가 돌아갈 준비가 됐는지 점검한다.
 *   node scripts/doctor.mjs
 *
 * 빠진 게 있으면 무엇을 어떻게 해야 하는지 알려 준다.
 */
import path from "node:path";
import fs from "node:fs";
import { ROOT } from "./lib.mjs";

const ok = [];
const warn = [];
const fail = [];

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// 1. Node 버전 — .ts 타입 스트리핑이 필요하므로 22.6+ 이어야 한다
const major = Number(process.versions.node.split(".")[0]);
if (major >= 22) ok.push(`Node ${process.versions.node}`);
else fail.push(`Node ${process.versions.node} — 22 이상이 필요합니다 (.ts 파일을 직접 불러옵니다). https://nodejs.org 에서 LTS 설치`);

// 2. 의존성
if (exists("node_modules/remotion")) ok.push("의존성 설치됨");
else fail.push("의존성 없음 — `npm install` 을 실행하세요");

// 3. 한글 폰트 (저장소에 포함)
if (exists("public/fonts/PretendardVariable.woff2")) ok.push("한글 폰트 포함됨");
else warn.push("public/fonts/PretendardVariable.woff2 없음 — 시스템 폰트로 렌더되어 PC마다 글꼴이 달라집니다");

// 4. 로고
const brandFile = path.join(ROOT, "input", "brand.json");
if (fs.existsSync(brandFile)) {
  const brand = JSON.parse(fs.readFileSync(brandFile, "utf8"));
  ok.push(`브랜드: ${brand.name}`);
  if (brand.logo && !exists(`public/${brand.logo}`)) {
    warn.push(`로고 파일 없음 (public/${brand.logo}) — 학원명 이니셜 로고로 대체됩니다`);
  } else if (brand.logo) ok.push("로고 있음");
  if (brand.bgm && !exists(`public/${brand.bgm}`)) {
    warn.push(`배경음악 없음 (public/${brand.bgm}) — 배경음악 없이 렌더됩니다`);
  } else if (brand.bgm) ok.push("배경음악 있음");
} else fail.push("input/brand.json 이 없습니다");

// 5. TTS 키
let hasKey = Boolean(process.env.GOOGLE_TTS_API_KEY);
if (!hasKey && exists(".env")) {
  hasKey = /^\s*GOOGLE_TTS_API_KEY\s*=\s*\S+/m.test(
    fs.readFileSync(path.join(ROOT, ".env"), "utf8")
  );
}
if (hasKey) ok.push("TTS API 키 설정됨");
else
  warn.push(
    ".env 에 GOOGLE_TTS_API_KEY 가 없습니다 — 음성 없이(무음) 렌더는 됩니다.\n" +
      "     `cp .env.example .env` 후 키를 채우세요"
  );

// 6. 지문 스크립트
const inputs = fs.existsSync(path.join(ROOT, "input"))
  ? fs.readdirSync(path.join(ROOT, "input")).filter((f) => f.endsWith(".json") && f !== "brand.json" && !f.endsWith(".audio.json"))
  : [];
if (inputs.length) ok.push(`지문 스크립트 ${inputs.length}개: ${inputs.map((f) => f.replace(".json", "")).join(", ")}`);
else warn.push("input/ 에 지문 스크립트가 없습니다");

// ── 출력
const line = "─".repeat(64);
console.log(`\n${line}\n지문 영상 렌더러 점검\n${line}`);
ok.forEach((m) => console.log(`  [정상] ${m}`));
warn.forEach((m) => console.log(`  [주의] ${m}`));
fail.forEach((m) => console.log(`  [실패] ${m}`));
console.log(line);

if (fail.length) {
  console.log("\n위 [실패] 항목을 먼저 해결해야 렌더할 수 있습니다.\n");
  process.exit(1);
}
console.log(
  [
    "\n렌더할 준비가 됐습니다. 순서:",
    `  node scripts/tts.mjs ${inputs[0]?.replace(".json", "") ?? "<slug>"}      # 음성 생성 (키 필요)`,
    `  node scripts/stills.mjs ${inputs[0]?.replace(".json", "") ?? "<slug>"}   # 화면 검토`,
    `  node scripts/render.mjs ${inputs[0]?.replace(".json", "") ?? "<slug>"}   # MP4 렌더`,
    "",
  ].join("\n")
);
