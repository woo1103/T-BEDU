/**
 * 씬별 대표 프레임을 PNG로 뽑는다. 영상 전체를 렌더하기 전에
 * 레이아웃·가독성을 눈으로 검토(self-refine)하는 용도.
 *   node scripts/stills.mjs <slug> [씬번호...]
 * 결과: out/stills/<slug>-01.png ...
 */
import path from "node:path";
import { renderStill } from "@remotion/renderer";
import {
  ROOT,
  ensureDir,
  getBundle,
  getComposition,
  introMidFrame,
  readSpec,
  sceneMidFrames,
} from "./lib.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("사용법: node scripts/stills.mjs <slug> [씬번호...]");
  process.exit(1);
}
const only = process.argv.slice(3).map(Number).filter((n) => !Number.isNaN(n));

const spec = readSpec(slug);
const serveUrl = await getBundle();
const composition = await getComposition(serveUrl, spec);
const frames = sceneMidFrames(spec);
const dir = ensureDir(path.join(ROOT, "out", "stills"));

// 브랜드 인트로 스틸 (00번)
const intro = introMidFrame(spec);
if (intro !== null && !only.length) {
  const output = path.join(dir, `${slug}-00-intro.png`);
  await renderStill({ composition, serveUrl, output, frame: intro, inputProps: spec, overwrite: true });
  console.log(`0. intro     f${intro}  ->  ${output}`);
}

for (let i = 0; i < frames.length; i++) {
  const sceneNo = i + 1;
  if (only.length && !only.includes(sceneNo)) continue;
  const output = path.join(dir, `${slug}-${String(sceneNo).padStart(2, "0")}.png`);
  await renderStill({
    composition,
    serveUrl,
    output,
    frame: frames[i],
    inputProps: spec,
    overwrite: true,
  });
  console.log(`${sceneNo}. ${spec.scenes[i].type.padEnd(9)} f${frames[i]}  ->  ${output}`);
}

console.log(`총 ${composition.durationInFrames} 프레임 / ${(composition.durationInFrames / composition.fps).toFixed(1)}초`);
process.exit(0);
