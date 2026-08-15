import path from "node:path";
import fs from "node:fs";
import { ROOT } from "./lib.mjs";

/**
 * WAV(LINEAR16)로 받는다.
 * MP3보다 파일은 크지만 **바이트 수로 길이를 정확히 계산**할 수 있어
 * 클립마다 ffprobe 프로세스를 띄우지 않아도 된다. 씬 길이가 음성에 정확히 맞아야 하므로
 * 추정이 아닌 정확한 값이 중요하다.
 */
const SAMPLE_RATE = 24000;
const WAV_HEADER_BYTES = 44;

/** .env 에서 키를 읽는다 (환경변수가 있으면 그쪽 우선) */
export const apiKey = () => {
  if (process.env.GOOGLE_TTS_API_KEY) return process.env.GOOGLE_TTS_API_KEY;

  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) {
    const m = fs
      .readFileSync(envFile, "utf8")
      .match(/^\s*GOOGLE_TTS_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }

  console.error(
    [
      "GOOGLE_TTS_API_KEY 가 없습니다.",
      "",
      "설정 방법:",
      "  1. https://console.cloud.google.com 에서 프로젝트를 만든다",
      "  2. 'Cloud Text-to-Speech API' 를 사용 설정한다",
      "  3. API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > API 키",
      `  4. ${path.join(ROOT, ".env")} 파일에 아래 한 줄을 넣는다`,
      "",
      "     GOOGLE_TTS_API_KEY=발급받은키",
      "",
    ].join("\n")
  );
  process.exit(1);
};

/** 기본 나레이터 목소리 — 차분하고 따뜻한 여성 톤 */
export const DEFAULT_NARRATOR = { name: "ko-KR-Neural2-A", rate: 0.92, pitch: -1.5 };

/**
 * 한 조각을 음성으로 만들어 파일로 저장한다.
 * Chirp3-HD 계열은 rate/pitch 를 받지 않으므로 구분해서 보낸다.
 */
export const synthesize = async (text, voice, outFile) => {
  const isChirp = voice.name.includes("Chirp");
  const audioConfig = { audioEncoding: "LINEAR16", sampleRateHertz: SAMPLE_RATE };
  if (!isChirp) {
    audioConfig.speakingRate = voice.rate ?? 1;
    audioConfig.pitch = voice.pitch ?? 0;
  }

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "ko-KR", name: voice.name },
        audioConfig,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`TTS 실패 (HTTP ${res.status}) — ${await res.text()}`);
  }
  const { audioContent } = await res.json();
  const buf = Buffer.from(audioContent, "base64");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);

  // 16비트 모노 PCM이므로 샘플당 2바이트 → 길이를 정확히 계산할 수 있다
  return (buf.length - WAV_HEADER_BYTES) / (SAMPLE_RATE * 2);
};

/**
 * 씬 스크립트에서 음성으로 만들 조각들을 뽑는다.
 * 키 형식은 duration.ts / scenes.tsx 의 voiceTrack 과 반드시 일치해야 한다.
 */
export const collectUtterances = (spec) => {
  const items = [];
  const narrator = spec.brand?.narratorVoice ?? DEFAULT_NARRATOR;
  const voiceOf = (who) => spec.characters?.[who]?.voice ?? narrator;

  spec.scenes.forEach((scene, i) => {
    const add = (key, text, voice) => {
      if (text && text.trim()) items.push({ id: `s${i}-${key}`, text: text.trim(), voice });
    };

    // 3인칭 나레이션은 항상 나레이터 목소리
    add("narration", scene.narration, narrator);
    add("narrationOut", scene.narrationOut, narrator);

    // 1인칭 대사는 그 인물의 목소리
    if (scene.type === "hook") {
      add("question", scene.question, voiceOf(scene.cast?.[0]?.who));
    }
    if (scene.type === "dialogue") {
      scene.lines.forEach((l, n) => add(`line${n}`, l.text, voiceOf(l.who)));
    }
    if (scene.type === "story" && scene.speech) {
      add("speech", scene.speech.text, voiceOf(scene.speech.who));
    }
  });

  return items;
};
