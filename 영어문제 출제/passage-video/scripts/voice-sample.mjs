/**
 * 후보 목소리들을 한 파일에 이어 붙여 들어 볼 수 있게 만든다.
 * 목소리는 귀로 골라야 하므로, 영상을 통째로 렌더하기 전에 이걸로 먼저 정한다.
 *
 *   node scripts/voice-sample.mjs narrator   # 나레이터 후보
 *   node scripts/voice-sample.mjs cast       # 인물 후보
 *
 * 결과: out/voice-<종류>.wav
 */
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { ROOT, ensureDir } from "./lib.mjs";
import { synthesize } from "./tts-lib.mjs";

const SAMPLE_RATE = 24000;
const HEADER = 44;

/** 3인칭 나레이션 톤을 확인할 문장 */
const NARRATION = "이번 지문은 우리 기억이 실제로 어떻게 작동하는지를 다루고 있어요.";

const SETS = {
  narrator: {
    text: NARRATION,
    candidates: [
      { label: "1번", name: "ko-KR-Neural2-A", rate: 0.92, pitch: -1.5 },
      { label: "2번", name: "ko-KR-Chirp3-HD-Aoede", rate: 0.9 },
      { label: "3번", name: "ko-KR-Chirp3-HD-Callirrhoe", rate: 0.9 },
      { label: "4번", name: "ko-KR-Chirp3-HD-Leda", rate: 0.9 },
      { label: "5번", name: "ko-KR-Chirp3-HD-Vindemiatrix", rate: 0.9 },
      { label: "6번", name: "ko-KR-Chirp3-HD-Achernar", rate: 0.9 },
    ],
  },
  cast: {
    text: null, // 후보마다 다른 대사
    candidates: [
      { label: "1번, 학생", name: "ko-KR-Chirp3-HD-Leda", rate: 1.0,
        text: "제 기억이 틀렸다는 게 말이 돼요? 저는 그날을 아주 또렷하게 기억하는데요." },
      { label: "2번, 학생", name: "ko-KR-Chirp3-HD-Zephyr", rate: 1.0,
        text: "제 기억이 틀렸다는 게 말이 돼요? 저는 그날을 아주 또렷하게 기억하는데요." },
      { label: "3번, 학생", name: "ko-KR-Neural2-B", rate: 1.05, pitch: 2.5,
        text: "제 기억이 틀렸다는 게 말이 돼요? 저는 그날을 아주 또렷하게 기억하는데요." },
      { label: "4번, 박사", name: "ko-KR-Chirp3-HD-Charon", rate: 0.95,
        text: "또렷한 느낌과 정확함은 다른 문제예요. 뇌는 빈칸을 아주 자연스럽게 메워 버리죠." },
      { label: "5번, 박사", name: "ko-KR-Chirp3-HD-Iapetus", rate: 0.95,
        text: "또렷한 느낌과 정확함은 다른 문제예요. 뇌는 빈칸을 아주 자연스럽게 메워 버리죠." },
      { label: "6번, 박사", name: "ko-KR-Neural2-C", rate: 0.95, pitch: -3,
        text: "또렷한 느낌과 정확함은 다른 문제예요. 뇌는 빈칸을 아주 자연스럽게 메워 버리죠." },
    ],
  },
};

const kind = process.argv[2] ?? "narrator";
const set = SETS[kind];
if (!set) {
  console.error(`사용법: node scripts/voice-sample.mjs [${Object.keys(SETS).join("|")}]`);
  process.exit(1);
}

const tmp = ensureDir(path.join(ROOT, "out", ".voice-tmp"));
const pcms = [];
const silence = Buffer.alloc(SAMPLE_RATE * 2 * 0.7); // 후보 사이 0.7초 쉼

for (const v of set.candidates) {
  const text = `${v.label}. ${v.text ?? set.text}`;
  const file = path.join(tmp, `${v.name}.wav`);
  const seconds = await synthesize(text, v, file);
  pcms.push(fs.readFileSync(file).subarray(HEADER), silence);
  console.log(`  ${v.label.padEnd(10)} ${v.name.padEnd(30)} ${seconds.toFixed(1)}초`);
}

const pcm = Buffer.concat(pcms);

// 표준 WAV 헤더를 직접 써서 하나로 합친다
const header = Buffer.alloc(HEADER);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // 모노
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const wav = path.join(ensureDir(path.join(ROOT, "out")), `voice-${kind}.wav`);
fs.writeFileSync(wav, Buffer.concat([header, pcm]));
fs.rmSync(tmp, { recursive: true, force: true });

// 들어 보는 용도이므로 mp3 로도 내보낸다.
// WAV 는 재생기·메신저에 따라 안 열리는 경우가 있어서 mp3 쪽을 전달한다.
const mp3 = wav.replace(/\.wav$/, ".mp3");
try {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error",
     "-i", wav, "-c:a", "libmp3lame", "-b:a", "160k", "-ar", "44100", mp3, "-y"],
    { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] }
  );
  console.log(`\n완료: ${mp3}  (${(pcm.length / (SAMPLE_RATE * 2)).toFixed(1)}초)`);
  console.log(`      ${wav} (원본)`);
} catch (e) {
  console.warn("\nmp3 변환 실패 — wav 만 만들었습니다.", e.message);
  console.log(`완료: ${wav}  (${(pcm.length / (SAMPLE_RATE * 2)).toFixed(1)}초)`);
}
