import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";
// Node 24의 타입 스트리핑으로 .ts 를 그대로 불러온다 (씬 경계 계산 공유)
import { sceneDurations, introFrames } from "../src/duration.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FPS = 30;

/** 학원 브랜딩은 지문과 무관하므로 input/brand.json 한 곳에서 읽어 온다 */
const readBrand = () => {
  const file = path.join(ROOT, "input", "brand.json");
  if (!fs.existsSync(file)) return null;
  const brand = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!brand?.name) return null;
  // 파일이 실제로 없는 항목은 지운다 (로고는 이니셜로, 배경음악은 무음으로 떨어진다)
  if (brand.logo && !fs.existsSync(path.join(ROOT, "public", brand.logo))) {
    console.warn(`로고 파일을 찾지 못했습니다: public/${brand.logo} → 이니셜로 대체합니다.`);
    delete brand.logo;
  }
  if (brand.bgm && !fs.existsSync(path.join(ROOT, "public", brand.bgm))) {
    console.warn(`배경음악 파일을 찾지 못했습니다: public/${brand.bgm} → 배경음악 없이 렌더합니다.`);
    delete brand.bgm;
  }
  return brand;
};

export const readSpec = (slug) => {
  const file = path.join(ROOT, "input", `${slug}.json`);
  if (!fs.existsSync(file)) {
    const available = fs.existsSync(path.join(ROOT, "input"))
      ? fs
          .readdirSync(path.join(ROOT, "input"))
          .filter((f) => f.endsWith(".json") && f !== "brand.json")
          .join(", ")
      : "(없음)";
    throw new Error(`입력 파일이 없습니다: ${file}\n사용 가능: ${available}`);
  }
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  const brand = readBrand();
  if (brand) spec.brand = brand;

  // 생성된 음성이 있으면 붙인다. 없으면 무음 영상이 된다.
  const audioFile = path.join(ROOT, "input", `${slug}.audio.json`);
  if (fs.existsSync(audioFile)) {
    spec.audio = JSON.parse(fs.readFileSync(audioFile, "utf8"));
  }
  return spec;
};

let cached = null;

export const getBundle = async () => {
  if (cached) return cached;
  process.stdout.write("번들링 중...\n");
  cached = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    outDir: path.join(ROOT, ".bundle"),
  });
  return cached;
};

export const getComposition = (serveUrl, spec) =>
  selectComposition({ serveUrl, id: "Passage", inputProps: spec });

/** 씬별 대표 프레임 (씬 안에서 62% 지점 — 애니메이션이 다 끝난 시점) */
export const sceneMidFrames = (spec) => {
  const durs = sceneDurations(spec, FPS);
  // 브랜드 인트로가 앞에 붙으면 그만큼 밀린다
  let acc = introFrames(spec);
  return durs.map((d) => {
    const mid = acc + Math.floor(d * 0.62);
    acc += d;
    return mid;
  });
};

/** 인트로 카드 대표 프레임 (없으면 null) */
export const introMidFrame = (spec) =>
  introFrames(spec) ? Math.floor(introFrames(spec) * 0.62) : null;

export const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
