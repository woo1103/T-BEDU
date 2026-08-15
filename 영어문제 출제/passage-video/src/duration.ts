import type { AudioClip, Scene, VideoSpec } from "./types";

/**
 * 씬 길이 계산.
 * JSX가 없는 순수 모듈이라 Node에서도 그대로 import 할 수 있다
 * (스틸·TTS 스크립트가 씬 경계를 알아야 한다).
 *
 * 음성(spec.audio)이 있으면 **실제 음성 길이**로 길이를 잡고,
 * 없으면 자막 글자 수로 추정한다. 그래서 음성을 붙이면 자막과 목소리가 정확히 맞는다.
 */

// 자막을 눈으로만 읽을 때의 편한 속도. "이해 최우선"이므로 느긋하게 잡는다.
export const CPS_KO = 4.8;
export const CPS_EN = 9;

/** 음성이 끝난 뒤 다음 대사로 넘어가기까지의 숨 */
const BREATH = 0.42;

/** 브랜드 인트로 길이. Intro.tsx 와 공유한다 */
export const INTRO_FRAMES = 90;

export const readFrames = (
  text: string | undefined,
  fps: number,
  cps: number = CPS_KO
): number => (text ? Math.round(([...text].length / cps) * fps) : 0);

/**
 * 한 씬 안에서 음성/글자 길이를 물어보는 창구.
 * 씬 컴포넌트와 길이 계산이 같은 값을 쓰도록 한 곳으로 모았다.
 */
export type VoiceTrack = {
  /** 이 조각이 차지하는 프레임 수 */
  frames: (key: string, text: string | undefined, cps?: number) => number;
  /** 생성된 음성 파일 (없으면 undefined) */
  clip: (key: string) => AudioClip | undefined;
};

export const voiceTrack = (
  spec: Pick<VideoSpec, "audio">,
  sceneIndex: number,
  fps: number
): VoiceTrack => ({
  clip: (key) => spec.audio?.[`s${sceneIndex}-${key}`],
  frames: (key, text, cps = CPS_KO) => {
    const c = spec.audio?.[`s${sceneIndex}-${key}`];
    if (c) return Math.round((c.seconds + BREATH) * fps);
    return readFrames(text, fps, cps);
  },
});

/**
 * 3인칭 나레이션을 먼저 읽/들을 시간.
 * 이 구간이 지나야 인물이 입을 열고, 자막이 1인칭으로 바뀐다.
 */
export const leadInFrames = (
  s: { narration?: string },
  fps: number,
  v: VoiceTrack
): number => {
  const n = v.frames("narration", s.narration);
  return n > 0 ? n + Math.round(0.2 * fps) : Math.round(0.4 * fps);
};

/** 대사가 끝나고 3인칭으로 돌아와 마무리하는 시간 */
export const tailFrames = (
  s: { narrationOut?: string },
  fps: number,
  v: VoiceTrack
): number => {
  const n = v.frames("narrationOut", s.narrationOut);
  return n > 0 ? n + Math.round(0.2 * fps) : Math.round(0.55 * fps);
};

/** 대화 씬에서 각 줄이 등장/사라지는 프레임 */
export const dialogueTimings = (
  lines: { text: string }[],
  fps: number,
  leadIn: number,
  v: VoiceTrack
): { start: number; end: number }[] => {
  let t = leadIn;
  return lines.map((l, i) => {
    const dur = Math.max(
      Math.round(1.4 * fps),
      v.frames(`line${i}`, l.text) + (v.clip(`line${i}`) ? 0 : Math.round(0.7 * fps))
    );
    const seg = { start: t, end: t + dur };
    t += dur;
    return seg;
  });
};

/** hook 씬에서 1인칭 질문이 떠 있는 구간 */
export const hookTiming = (
  s: { narration?: string; question: string },
  fps: number,
  v: VoiceTrack
): { start: number; end: number } => {
  const start = leadInFrames(s, fps, v);
  const spoken = v.frames("question", s.question);
  const dur = v.clip("question") ? spoken + Math.round(0.5 * fps) : spoken + Math.round(1.7 * fps);
  return { start, end: start + dur };
};

/** story 씬에서 인물 한마디가 떠 있는 구간 */
export const storySpeechTiming = (
  s: { narration?: string; speech?: { text: string } },
  fps: number,
  v: VoiceTrack
): { start: number; end: number } | null => {
  if (!s.speech) return null;
  const start = leadInFrames(s, fps, v);
  const spoken = v.frames("speech", s.speech.text);
  return { start, end: start + spoken + Math.round(0.5 * fps) };
};

export const sceneDuration = (s: Scene, fps: number, v: VoiceTrack): number => {
  if (s.durationInFrames) return s.durationInFrames;

  const base = Math.round(1.1 * fps);
  let f =
    base +
    v.frames("narration", s.narration) +
    v.frames("english", s.english, CPS_EN);

  switch (s.type) {
    case "title":
      f = Math.max(f, Math.round(3.4 * fps));
      break;
    case "hook":
      // 3인칭 나레이션 → 1인칭 질문 → 3인칭 마무리
      f = hookTiming(s, fps, v).end + tailFrames(s, fps, v);
      break;
    case "dialogue": {
      const t = dialogueTimings(s.lines, fps, leadInFrames(s, fps, v), v);
      f = (t[t.length - 1]?.end ?? 0) + tailFrames(s, fps, v);
      break;
    }
    case "story": {
      const sp = storySpeechTiming(s, fps, v);
      const withSpeech = (sp ? sp.end : leadInFrames(s, fps, v)) + tailFrames(s, fps, v);
      f = Math.max(withSpeech, readFrames(s.caption, fps) + Math.round(1.8 * fps));
      break;
    }
    case "concept":
      f = Math.max(f, readFrames(s.meaning, fps) + Math.round(1.6 * fps));
      break;
    case "compare": {
      const bullets = s.left.points.length + s.right.points.length;
      f = Math.max(f, Math.round(2 * fps) + bullets * Math.round(0.5 * fps));
      break;
    }
    case "flow":
      f = Math.max(f, Math.round(1.6 * fps) + s.steps.length * Math.round(0.62 * fps));
      break;
    case "bars":
      f = Math.max(f, Math.round(1.8 * fps) + s.bars.length * Math.round(0.4 * fps));
      break;
    case "analogy":
      f = Math.max(f, readFrames(s.because, fps) + Math.round(1.8 * fps));
      break;
    case "quote":
      f = Math.max(
        f,
        readFrames(s.sentence, fps, CPS_EN) + readFrames(s.translation, fps) + Math.round(1.6 * fps)
      );
      break;
    case "recap":
      f = Math.max(f, Math.round(1.4 * fps) + s.points.length * Math.round(0.9 * fps));
      break;
  }

  return Math.max(Math.round(2.4 * fps), f);
};

// voiceTrack 은 음성이 없으면 글자 수 추정으로 자동 폴백하므로 항상 이걸 쓴다.
// 렌더(Video.tsx)와 길이 계산이 서로 다른 창구를 쓰면 자막이 어긋난다.
export const sceneDurations = (spec: VideoSpec, fps: number): number[] =>
  spec.scenes.map((s, i) => sceneDuration(s, fps, voiceTrack(spec, i, fps)));

/** 인트로가 차지하는 프레임 (brand 가 없으면 0) */
export const introFrames = (spec: VideoSpec): number => (spec.brand ? INTRO_FRAMES : 0);

export const totalFrames = (spec: VideoSpec, fps: number): number =>
  introFrames(spec) + sceneDurations(spec, fps).reduce((a, b) => a + b, 0);
