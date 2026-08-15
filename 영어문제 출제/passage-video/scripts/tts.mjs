/**
 * 씬 스크립트의 나레이션·대사를 음성으로 만든다.
 *   node scripts/tts.mjs <slug>
 *
 * 결과: public/audio/<slug>/*.mp3  +  input/<slug>.audio.json (길이 정보)
 * 텍스트가 그대로면 다시 만들지 않는다 (요금·시간 절약). 전부 다시 만들려면 --force.
 */
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { ROOT, readSpec } from "./lib.mjs";
import { collectUtterances, synthesize } from "./tts-lib.mjs";

const slug = process.argv[2];
const force = process.argv.includes("--force");
if (!slug) {
  console.error("사용법: node scripts/tts.mjs <slug> [--force]");
  process.exit(1);
}

const spec = readSpec(slug);
const items = collectUtterances(spec);
if (!items.length) {
  console.error("음성으로 만들 나레이션·대사가 없습니다.");
  process.exit(1);
}

const audioDir = path.join(ROOT, "public", "audio", slug);
const manifestFile = path.join(ROOT, "input", `${slug}.audio.json`);
const prev = fs.existsSync(manifestFile)
  ? JSON.parse(fs.readFileSync(manifestFile, "utf8"))
  : {};

const stamp = (it) =>
  crypto
    .createHash("sha1")
    .update(`${it.text}|${it.voice.name}|${it.voice.rate ?? 1}|${it.voice.pitch ?? 0}`)
    .digest("hex")
    .slice(0, 12);

const manifest = {};
let made = 0;
let reused = 0;

for (const it of items) {
  const rel = `audio/${slug}/${it.id}.wav`;
  const abs = path.join(ROOT, "public", rel);
  const hash = stamp(it);
  const old = prev[it.id];

  if (!force && old?.hash === hash && fs.existsSync(abs)) {
    manifest[it.id] = old;
    reused++;
    continue;
  }

  const seconds = await synthesize(it.text, it.voice, abs);
  manifest[it.id] = { file: rel, seconds, hash, voice: it.voice.name };
  made++;
  console.log(`  ${it.id.padEnd(18)} ${it.voice.name.padEnd(22)} ${seconds.toFixed(2)}초`);
}

// 더 이상 쓰이지 않는 음성 파일 정리
const live = new Set(items.map((it) => `${it.id}.wav`));
if (fs.existsSync(audioDir)) {
  for (const f of fs.readdirSync(audioDir)) {
    if (!live.has(f)) {
      fs.unlinkSync(path.join(audioDir, f));
      console.log(`  (삭제) ${f}`);
    }
  }
}

fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const totalSec = Object.values(manifest).reduce((a, c) => a + c.seconds, 0);
const chars = items.reduce((a, it) => a + [...it.text].length, 0);
console.log(
  `\n새로 생성 ${made}개 / 재사용 ${reused}개 · 음성 합계 ${totalSec.toFixed(1)}초 · ${chars}자`
);
console.log(`저장: ${manifestFile}`);
