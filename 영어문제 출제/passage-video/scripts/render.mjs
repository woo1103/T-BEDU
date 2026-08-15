/**
 * 지문 하나를 MP4로 렌더링한다.
 *   node scripts/render.mjs <slug>
 * 결과: out/<slug>.mp4
 */
import path from "node:path";
import { renderMedia } from "@remotion/renderer";
import { ROOT, ensureDir, getBundle, getComposition, readSpec } from "./lib.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("사용법: node scripts/render.mjs <slug>");
  process.exit(1);
}

const spec = readSpec(slug);
const serveUrl = await getBundle();
const composition = await getComposition(serveUrl, spec);

const seconds = (composition.durationInFrames / composition.fps).toFixed(1);
console.log(`"${spec.title}" — ${spec.scenes.length}씬 / ${seconds}초`);

const outputLocation = path.join(ensureDir(path.join(ROOT, "out")), `${slug}.mp4`);

let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation,
  inputProps: spec,
  crf: 20,
  concurrency: null,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct >= last + 10) {
      last = pct;
      process.stdout.write(`  렌더 ${pct}%\n`);
    }
  },
});

console.log(`완료: ${outputLocation}`);
process.exit(0);
