/**
 * Google Cloud TTS 가 지금 실제로 제공하는 한국어 목소리 목록을 뽑는다.
 * 목소리 이름을 추측해서 쓰면 안 되므로, 배정 전에 이 목록으로 확인한다.
 *   node scripts/voices.mjs
 */
import { apiKey } from "./tts-lib.mjs";

const res = await fetch(
  `https://texttospeech.googleapis.com/v1/voices?languageCode=ko-KR&key=${apiKey()}`
);
if (!res.ok) {
  console.error(`목소리 목록을 못 가져왔습니다 (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}
const { voices = [] } = await res.json();

const rank = { "Chirp3-HD": 0, Neural2: 1, Wavenet: 2, Standard: 3 };
const tier = (n) => Object.keys(rank).find((k) => n.includes(k)) ?? "기타";

voices
  .sort((a, b) => (rank[tier(a.name)] ?? 9) - (rank[tier(b.name)] ?? 9) || a.name.localeCompare(b.name))
  .forEach((v) => {
    const gender = { FEMALE: "여성", MALE: "남성", NEUTRAL: "중성" }[v.ssmlGender] ?? v.ssmlGender;
    console.log(`${v.name.padEnd(28)} ${gender}  ${tier(v.name)}`);
  });

console.log(`\n총 ${voices.length}종`);
