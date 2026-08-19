import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type {
  CharacterOnStage,
  CharacterPreset,
  Scene,
  VideoSpec,
} from "./types";
import { theme } from "./theme";
import { Character, shade } from "./Character";
import {
  Bubble,
  Card,
  Heading,
  IconDisc,
  SceneFrame,
  Setting,
  fitFont,
  usePop,
  useRise,
} from "./ui";

// 길이 계산은 Node 스크립트와 공유하기 위해 JSX 없는 모듈에 있다.
export { dialogueTimings, sceneDuration, sceneDurations, totalFrames } from "./duration";
import {
  dialogueTimings,
  hookTiming,
  leadInFrames,
  storySpeechTiming,
  voiceTrack,
} from "./duration";
import type { VoiceTrack } from "./duration";
import type { SpeechBand } from "./ui";

/**
 * 생성된 음성 한 조각을 정해진 프레임에 재생한다.
 * 음성이 없으면 아무것도 하지 않으므로 무음 렌더도 그대로 동작한다.
 */
const Voice: React.FC<{ track: VoiceTrack; id: string; at: number }> = ({ track, id, at }) => {
  const clip = track.clip(id);
  if (!clip) return null;
  return (
    <Sequence from={at} layout="none">
      <Audio src={staticFile(clip.file)} />
    </Sequence>
  );
};

/**
 * 1인칭 자막에 쓸 이름과 색을 캐릭터 프리셋에서 뽑는다.
 * 인물마다 자막 밴드 색이 달라 누가 말하는지 바로 구분된다.
 */
const speechBandFor = (
  characters: Record<string, CharacterPreset>,
  line: { who: string; text: string; thought?: boolean }
): SpeechBand => {
  const p = characters[line.who];
  return {
    name: p?.name,
    color: p?.outfitColor ?? theme.coral,
    text: line.text,
    thought: line.thought,
  };
};

// ─────────────────────────────────────────────── 캐릭터 배치 헬퍼

const StageChar: React.FC<{
  cast: CharacterOnStage;
  characters: Record<string, CharacterPreset>;
  /** 강제로 말하기 상태를 켜고 끔 */
  talkingOverride?: boolean;
  dim?: boolean;
  height?: number;
  delay?: number;
}> = ({ cast, characters, talkingOverride, dim, height, delay = 0 }) => {
  const preset = characters[cast.who];
  const rise = useRise(delay, 34);
  if (!preset) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        ...rise,
        filter: dim ? "saturate(0.55) brightness(0.94)" : undefined,
        // 등장 애니메이션의 투명도에 "말하지 않는 사람 흐리기"를 곱한다
        opacity: rise.opacity * (dim ? 0.72 : 1),
      }}
    >
      <Character
        preset={preset}
        expression={cast.expression}
        pose={cast.pose}
        talking={talkingOverride ?? cast.talking}
        flip={cast.flip}
        height={height ?? cast.height ?? 420}
        seedKey={cast.who}
      />
      {preset.name ? (
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 26,
            fontWeight: 800,
            color: theme.ink,
            background: "rgba(255,255,255,0.9)",
            border: `3px solid ${theme.line}`,
            borderRadius: 999,
            padding: "3px 20px",
          }}
        >
          {preset.name}
        </div>
      ) : null}
    </div>
  );
};

type SceneProps<T> = {
  scene: T;
  spec: VideoSpec;
  index: number;
  total: number;
  accent: string;
  /** 이 씬의 음성 조각들. 길이 계산과 재생이 같은 값을 쓴다 */
  track: VoiceTrack;
};

// ─────────────────────────────────────────────── title

const TitleScene: React.FC<SceneProps<Extract<Scene, { type: "title" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const rise = useRise(6, 30);
  const sub = useRise(16, 20);
  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      narration={scene.narration}
      english={scene.english}
      bare
    >
      <Setting kind="plain" accent={accent} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        {/* 표지에는 지문 출처를 크게 */}
        {spec.source ? (
          <div
            style={{
              fontFamily: theme.font,
              fontSize: 30,
              fontWeight: 800,
              color: "#FFFFFF",
              background: accent,
              border: `4px solid ${theme.line}`,
              borderRadius: 999,
              padding: "9px 32px",
              letterSpacing: -0.3,
              ...sub,
            }}
          >
            {spec.source}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: theme.font,
            fontSize: fitFont(scene.title, 104, 16, 54),
            fontWeight: 900,
            color: theme.ink,
            letterSpacing: -3,
            textAlign: "center",
            maxWidth: 1560,
            lineHeight: 1.12,
            wordBreak: "keep-all",
            ...rise,
          }}
        >
          {scene.title}
        </div>
        {scene.subtitle ? (
          <div
            style={{
              fontFamily: theme.font,
              fontSize: fitFont(scene.subtitle, 40, 34, 26),
              fontWeight: 700,
              color: theme.inkSoft,
              textAlign: "center",
              maxWidth: 1400,
              wordBreak: "keep-all",
              ...sub,
            }}
          >
            {scene.subtitle}
          </div>
        ) : null}
      </div>

      {scene.cast?.length ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 262,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: 40,
          }}
        >
          {scene.cast.map((c, i) => (
            <StageChar
              key={i}
              cast={c}
              characters={spec.characters}
              height={c.height ?? 400}
              delay={20 + i * 8}
            />
          ))}
        </div>
      ) : null}
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── hook

const HookScene: React.FC<SceneProps<Extract<Scene, { type: "hook" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
  track,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = hookTiming(scene, fps, track);

  // 나레이션(3인칭) → 질문(1인칭) → 마무리 나레이션(3인칭)
  const speaking = frame >= t.start && frame < t.end;
  const after = frame >= t.end;
  const line = { who: scene.cast[0]?.who ?? "", text: scene.question, thought: scene.thought };

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker="생각해 볼까?"
      narration={after ? (scene.narrationOut ?? scene.narration) : scene.narration}
      english={speaking ? undefined : scene.english}
      speech={speaking ? speechBandFor(spec.characters, line) : undefined}
    >
      <Voice track={track} id="question" at={t.start} />
      <Voice track={track} id="narrationOut" at={t.end} />
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 150,
          bottom: 262,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        <StageChar
          cast={{ ...scene.cast[0], talking: speaking && !scene.thought }}
          characters={spec.characters}
          height={scene.cast[0]?.height ?? 540}
        />
        {/*
          질문 구간이 끝나도 풍선을 지우지 않고 흐리게 남긴다.
          지우면 마무리 나레이션 동안 화면이 텅 비고, 아이들이 무슨 질문이었는지 잊는다.
        */}
        <div style={{ paddingBottom: 90, opacity: after ? 0.42 : 1 }}>
          {frame >= t.start ? (
            <Bubble
              text={scene.question}
              tail="left"
              width={940}
              delay={t.start}
              color="#FFFFFF"
              thought={scene.thought}
            />
          ) : null}
        </div>
      </div>
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── dialogue

const DialogueScene: React.FC<SceneProps<Extract<Scene, { type: "dialogue" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
  track,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timings = dialogueTimings(scene.lines, fps, leadInFrames(scene, fps, track), track);

  // 대사 구간 안이면 그 줄이 활성, 아니면 나레이션 구간
  const active = timings.findIndex((t) => frame >= t.start && frame < t.end);
  const line = active >= 0 ? scene.lines[active] : null;
  const speaker = line?.who;
  const after = frame >= (timings[timings.length - 1]?.end ?? 0);

  // 말하는 사람이 왼쪽인지 오른쪽인지
  const leftWho = scene.cast[0]?.who;
  const tail: "left" | "right" = speaker === leftWho ? "left" : "right";

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      setting={scene.setting ?? "plain"}
      narration={line ? undefined : after ? (scene.narrationOut ?? scene.narration) : scene.narration}
      english={line ? undefined : scene.english}
      speech={line ? speechBandFor(spec.characters, line) : undefined}
    >
      {/* 대사 음성 — 각 줄이 화면에 뜨는 프레임에 맞춰 재생 */}
      {timings.map((seg, i) => (
        <Voice key={i} track={track} id={`line${i}`} at={seg.start} />
      ))}
      <Voice track={track} id="narrationOut" at={timings[timings.length - 1]?.end ?? 0} />

      {/* 말풍선 */}
      {line ? (
        <div
          key={active}
          style={{
            position: "absolute",
            top: 130,
            [tail === "left" ? "left" : "right"]: 140,
            width: 900,
          }}
        >
          <Bubble text={line.text} tail={tail} width={900} delay={0} thought={line.thought} />
        </div>
      ) : null}

      {/* 캐릭터 */}
      <div
        style={{
          position: "absolute",
          left: 130,
          right: 130,
          bottom: 262,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {scene.cast.slice(0, 2).map((c, i) => (
          <StageChar
            key={i}
            cast={c}
            characters={spec.characters}
            talkingOverride={c.who === speaker && !line?.thought}
            dim={Boolean(speaker) && c.who !== speaker}
            height={c.height ?? 440}
            delay={i * 6}
          />
        ))}
      </div>
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── story

const StoryScene: React.FC<SceneProps<Extract<Scene, { type: "story" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
  track,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cap = useRise(4, 18);
  const sfx = usePop(14);

  // 3인칭 서술 → (있으면) 인물 한마디 1인칭 → 3인칭 마무리
  const sp = storySpeechTiming(scene, fps, track);
  const speaking = Boolean(sp && frame >= sp.start && frame < sp.end);
  const after = Boolean(sp && frame >= sp.end);

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      setting={scene.setting ?? "plain"}
      narration={speaking ? undefined : after ? (scene.narrationOut ?? scene.narration) : scene.narration}
      english={speaking ? undefined : scene.english}
      speech={speaking && scene.speech ? speechBandFor(spec.characters, scene.speech) : undefined}
    >
      {sp ? <Voice track={track} id="speech" at={sp.start} /> : null}
      <Voice track={track} id="narrationOut" at={sp ? sp.end : leadInFrames(scene, fps, track)} />

      {/* 인물 한마디 말풍선 — 인물이 화면 가운데 서므로 꼬리는 오른쪽(인물 쪽)으로 */}
      {sp && frame >= sp.start && scene.speech ? (
        <div style={{ position: "absolute", left: 150, top: 268, width: 760 }}>
          <Bubble
            text={scene.speech.text}
            tail="right"
            width={760}
            delay={sp.start}
            thought={scene.speech.thought}
          />
        </div>
      ) : null}
      {scene.caption ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 120,
            display: "flex",
            justifyContent: "center",
            ...cap,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.95)",
              border: `5px solid ${theme.line}`,
              borderRadius: 20,
              padding: "16px 38px",
              fontFamily: theme.font,
              fontSize: fitFont(scene.caption, 44, 40, 28),
              fontWeight: 800,
              color: theme.ink,
              maxWidth: 1500,
              textAlign: "center",
              wordBreak: "keep-all",
              boxShadow: `0 8px 0 ${theme.shadow}`,
            }}
          >
            {scene.caption}
          </div>
        </div>
      ) : null}

      {scene.sfx ? (
        <div
          style={{
            position: "absolute",
            right: 200,
            top: 300,
            fontFamily: theme.font,
            fontSize: 110,
            fontWeight: 900,
            color: accent,
            WebkitTextStroke: `8px ${theme.line}`,
            paintOrder: "stroke fill",
            ...sfx,
            transform: `rotate(-10deg) ${sfx.transform}`,
          }}
        >
          {scene.sfx}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 262,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 70,
        }}
      >
        {scene.cast.map((c, i) => (
          <StageChar
            key={i}
            cast={c}
            characters={spec.characters}
            talkingOverride={
              speaking && scene.speech?.who === c.who && !scene.speech?.thought
            }
            height={c.height ?? 440}
            delay={6 + i * 7}
          />
        ))}
      </div>
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── concept

const ConceptScene: React.FC<SceneProps<Extract<Scene, { type: "concept" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const hasCast = Boolean(scene.cast?.length);
  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker="핵심 개념"
      narration={scene.narration}
      english={scene.english}
    >
      <div
        style={{
          position: "absolute",
          left: 120,
          right: hasCast ? 520 : 120,
          top: 190,
          bottom: 300,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Card accent={accent} delay={6} style={{ width: "100%", padding: "42px 48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
            <IconDisc icon={scene.icon} color={shade(accent, 60)} size={150} delay={14} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: theme.font,
                  fontSize: fitFont(scene.term, 74, 16, 42),
                  fontWeight: 900,
                  color: theme.ink,
                  letterSpacing: -2,
                  marginBottom: 16,
                  wordBreak: "keep-all",
                }}
              >
                {scene.term}
              </div>
              <div
                style={{
                  height: 8,
                  width: 120,
                  background: accent,
                  borderRadius: 999,
                  marginBottom: 20,
                }}
              />
              <div
                style={{
                  fontFamily: theme.font,
                  fontSize: fitFont(scene.meaning, 44, 60, 28),
                  fontWeight: 600,
                  color: theme.inkSoft,
                  lineHeight: 1.45,
                  wordBreak: "keep-all",
                }}
              >
                {scene.meaning}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {hasCast ? (
        <div style={{ position: "absolute", right: 110, bottom: 262 }}>
          <StageChar
            cast={scene.cast![0]}
            characters={spec.characters}
            height={scene.cast![0].height ?? 400}
            delay={18}
          />
        </div>
      ) : null}
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── compare

const CompareScene: React.FC<SceneProps<Extract<Scene, { type: "compare" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const hasCast = Boolean(scene.cast?.length);
  const cardW = hasCast ? 640 : 770;
  const leftX = hasCast ? 100 : 130;
  const gap = 60;
  const vs = usePop(22);

  const side = (
    data: { label: string; points: string[]; icon?: string },
    color: string,
    x: number,
    delayBase: number
  ) => (
    // 제목 밑줄이 카드에 가리지 않도록 카드를 아래로 내린다
    <div style={{ position: "absolute", left: x, top: 262, width: cardW }}>
      <Card accent={color} delay={delayBase} style={{ padding: "24px 30px", minHeight: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
          <IconDisc icon={data.icon} color={shade(color, 62)} size={84} delay={delayBase + 4} />
          <div
            style={{
              fontFamily: theme.font,
              fontSize: fitFont(data.label, 50, 12, 32),
              fontWeight: 900,
              color: theme.ink,
              letterSpacing: -1.4,
              wordBreak: "keep-all",
            }}
          >
            {data.label}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.points.map((p, i) => (
            <Bullet key={i} text={p} color={color} delay={delayBase + 12 + i * 12} />
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker={scene.heading ? undefined : "비교해 보자"}
      narration={scene.narration}
      english={scene.english}
    >
      {scene.heading ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 108 }}>
          <Heading text={scene.heading} accent={accent} delay={2} />
        </div>
      ) : null}

      {side(scene.left, theme.blue, leftX, 8)}
      {side(scene.right, theme.coral, leftX + cardW + gap, 16)}

      {/* 가운데 VS */}
      <div
        style={{
          position: "absolute",
          left: leftX + cardW + gap / 2,
          top: 462,
          marginLeft: -34,
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: theme.ink,
          color: "#FFFFFF",
          border: `4px solid ${theme.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: theme.font,
          fontSize: 26,
          fontWeight: 900,
          ...vs,
        }}
      >
        VS
      </div>

      {hasCast ? (
        <div style={{ position: "absolute", right: 70, bottom: 268 }}>
          <StageChar
            cast={scene.cast![0]}
            characters={spec.characters}
            height={scene.cast![0].height ?? 370}
            delay={26}
          />
        </div>
      ) : null}
    </SceneFrame>
  );
};

const Bullet: React.FC<{ text: string; color: string; delay: number }> = ({
  text,
  color,
  delay,
}) => {
  const rise = useRise(delay, 16);
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", ...rise }}>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: color,
          border: `3px solid ${theme.line}`,
          marginTop: 12,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontFamily: theme.font,
          fontSize: fitFont(text, 36, 30, 25),
          fontWeight: 600,
          color: theme.ink,
          lineHeight: 1.4,
          wordBreak: "keep-all",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── flow

const FlowScene: React.FC<SceneProps<Extract<Scene, { type: "flow" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const n = Math.min(scene.steps.length, 5);
  const steps = scene.steps.slice(0, n);
  const hasCast = Boolean(scene.cast?.length);
  const boxW = n <= 3 ? 400 : n === 4 ? 330 : 270;
  const arrowW = n <= 3 ? 84 : 62;

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker={scene.heading ? undefined : "어떻게 이어지나"}
      narration={scene.narration}
      english={scene.english}
    >
      {scene.heading ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 118 }}>
          <Heading text={scene.heading} accent={accent} delay={2} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          // 캐릭터가 없으면 무대 가운데에 놓아 아래 여백이 뜨지 않게 한다
          top: hasCast ? 320 : 430,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {steps.map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Arrow width={arrowW} delay={10 + i * 18} color={accent} /> : null}
            <Card
              accent={i === n - 1 ? theme.green : accent}
              delay={6 + i * 18}
              style={{
                width: boxW,
                minHeight: 210,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "20px 18px",
              }}
            >
              {st.icon ? <div style={{ fontSize: 62, lineHeight: 1 }}>{st.icon}</div> : null}
              <div
                style={{
                  fontFamily: theme.font,
                  fontSize: fitFont(st.label, 38, 18, 24),
                  fontWeight: 800,
                  color: theme.ink,
                  textAlign: "center",
                  lineHeight: 1.3,
                  wordBreak: "keep-all",
                }}
              >
                {st.label}
              </div>
            </Card>
          </React.Fragment>
        ))}
      </div>

      {hasCast ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 262,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <StageChar
            cast={scene.cast![0]}
            characters={spec.characters}
            height={scene.cast![0].height ?? 300}
            delay={8 + n * 18}
          />
        </div>
      ) : null}
    </SceneFrame>
  );
};

const Arrow: React.FC<{ width: number; delay: number; color: string }> = ({
  width,
  delay,
  color,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg width={width} height={54} viewBox={`0 0 ${width} 54`} style={{ opacity: p }}>
      <path
        d={`M 6 27 L ${6 + (width - 30) * p} 27`}
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
      />
      <path
        d={`M ${width - 26} 10 L ${width - 6} 27 L ${width - 26} 44`}
        fill="none"
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={p > 0.8 ? 1 : 0}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────── bars

const BarsScene: React.FC<SceneProps<Extract<Scene, { type: "bars" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...scene.bars.map((b) => b.value), 1);
  const hasCast = Boolean(scene.cast?.length);
  const trackW = hasCast ? 1000 : 1300;

  // 막대가 적으면 두껍게 그리고 무대 가운데로 올린다.
  // 그대로 두면 2개짜리 그래프에서 화면 아래가 텅 빈다.
  const n = scene.bars.length;
  const barH = n <= 2 ? 92 : n <= 3 ? 76 : 62;
  const gap = n <= 3 ? 38 : 30;
  const blockH = n * barH + (n - 1) * gap;
  const top = 250 + Math.max(0, Math.round((580 - blockH) / 2));

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker={scene.heading ? undefined : "숫자로 보면"}
      narration={scene.narration}
      english={scene.english}
    >
      {scene.heading ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 118 }}>
          <Heading text={scene.heading} accent={accent} delay={2} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 130,
          top,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        {scene.bars.map((b, i) => {
          const delay = 10 + i * 12;
          const grow = interpolate(frame - delay, [0, Math.round(0.85 * fps)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: (t) => 1 - (1 - t) ** 3,
          });
          const color = [theme.blue, theme.coral, theme.green, theme.purple, theme.amber][i % 5];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  width: 300,
                  textAlign: "right",
                  fontFamily: theme.font,
                  fontSize: fitFont(b.label, 36, 14, 24),
                  fontWeight: 800,
                  color: theme.ink,
                  wordBreak: "keep-all",
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  width: trackW,
                  height: barH,
                  background: "rgba(35,40,56,0.08)",
                  borderRadius: 12,
                  border: `3px solid ${theme.line}`,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: (b.value / max) * trackW * grow,
                    height: "100%",
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 16,
                    fontFamily: theme.font,
                    fontSize: 32,
                    fontWeight: 900,
                    color: "#FFFFFF",
                    whiteSpace: "nowrap",
                  }}
                >
                  {grow > 0.85 ? `${b.value}${scene.unit ?? ""}` : ""}
                </div>
              </div>
              {b.note ? (
                <div
                  style={{
                    fontFamily: theme.font,
                    fontSize: 28,
                    fontWeight: 700,
                    color: theme.inkSoft,
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.note}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {hasCast ? (
        <div style={{ position: "absolute", right: 90, bottom: 268 }}>
          <StageChar
            cast={scene.cast![0]}
            characters={spec.characters}
            height={scene.cast![0].height ?? 360}
            delay={20}
          />
        </div>
      ) : null}
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── analogy

const AnalogyScene: React.FC<SceneProps<Extract<Scene, { type: "analogy" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const frame = useCurrentFrame();
  const eq = usePop(24);
  const wob = Math.sin(frame * 0.14) * 3;

  const pane = (
    d: { label: string; icon?: string },
    color: string,
    delay: number,
    tag: string
  ) => (
    <Card
      accent={color}
      delay={delay}
      style={{
        width: 560,
        minHeight: 330,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          fontFamily: theme.font,
          fontSize: 24,
          fontWeight: 800,
          color: "#FFFFFF",
          background: color,
          padding: "5px 20px",
          borderRadius: 999,
          border: `3px solid ${theme.line}`,
        }}
      >
        {tag}
      </div>
      <div style={{ fontSize: 96, lineHeight: 1 }}>{d.icon ?? "❓"}</div>
      <div
        style={{
          fontFamily: theme.font,
          fontSize: fitFont(d.label, 44, 16, 28),
          fontWeight: 900,
          color: theme.ink,
          textAlign: "center",
          letterSpacing: -1,
          wordBreak: "keep-all",
        }}
      >
        {d.label}
      </div>
    </Card>
  );

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker={scene.heading ? undefined : "쉽게 말하면"}
      narration={scene.narration}
      english={scene.english}
    >
      {scene.heading ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 112 }}>
          <Heading text={scene.heading} accent={accent} delay={2} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 234,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 42,
        }}
      >
        {pane(scene.concept, theme.purple, 6, "지문 속 개념")}
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 86,
            fontWeight: 900,
            color: accent,
            ...eq,
            transform: `rotate(${wob}deg) ${eq.transform}`,
          }}
        >
          ≈
        </div>
        {pane(scene.everyday, theme.green, 14, "우리 일상")}
      </div>

      <div
        style={{
          position: "absolute",
          left: 200,
          right: 200,
          top: 606,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Card
          delay={32}
          style={{
            background: shade(accent, 88),
            borderTop: `5px solid ${theme.line}`,
            padding: "22px 34px",
            maxWidth: 1300,
          }}
        >
          <div
            style={{
              fontFamily: theme.font,
              fontSize: fitFont(scene.because, 40, 46, 26),
              fontWeight: 700,
              color: theme.ink,
              textAlign: "center",
              lineHeight: 1.4,
              wordBreak: "keep-all",
            }}
          >
            {scene.because}
          </div>
        </Card>
      </div>
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── quote

const QuoteScene: React.FC<SceneProps<Extract<Scene, { type: "quote" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const rise = useRise(6, 26);
  const tr = useRise(20, 20);
  const hl = new Set((scene.highlight ?? []).map((h) => h.toLowerCase().replace(/[^a-z']/g, "")));

  const words = scene.sentence.split(/(\s+)/);

  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker="지문 한 문장"
      narration={scene.narration}
      dark
      bare
    >
      <div style={{ position: "absolute", inset: 0, background: "#1A1F33" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage: `radial-gradient(${accent} 2px, transparent 2.2px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 140,
          right: 140,
          top: 180,
          bottom: 280,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontEn,
            fontSize: fitFont(scene.sentence, 62, 90, 34),
            fontWeight: 400,
            color: "#FFFFFF",
            lineHeight: 1.45,
            ...rise,
          }}
        >
          <span style={{ color: accent, fontSize: "1.4em", fontWeight: 700 }}>“</span>
          {words.map((w, i) => {
            const key = w.toLowerCase().replace(/[^a-z']/g, "");
            const isHl = key.length > 0 && hl.has(key);
            return (
              <span
                key={i}
                style={
                  isHl
                    ? {
                        color: accent,
                        fontWeight: 700,
                        borderBottom: `4px solid ${accent}`,
                      }
                    : undefined
                }
              >
                {w}
              </span>
            );
          })}
          <span style={{ color: accent, fontSize: "1.4em", fontWeight: 700 }}>”</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, ...tr }}>
          <div
            style={{
              background: accent,
              color: "#FFFFFF",
              fontFamily: theme.font,
              fontSize: 26,
              fontWeight: 800,
              padding: "6px 18px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              marginTop: 8,
            }}
          >
            해석
          </div>
          <div
            style={{
              fontFamily: theme.font,
              fontSize: fitFont(scene.translation, 44, 56, 28),
              fontWeight: 700,
              color: "#E8ECF6",
              lineHeight: 1.4,
              wordBreak: "keep-all",
            }}
          >
            {scene.translation}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

// ─────────────────────────────────────────────── recap

const RecapScene: React.FC<SceneProps<Extract<Scene, { type: "recap" }>>> = ({
  scene,
  spec,
  index,
  total,
  accent,
}) => {
  const hasCast = Boolean(scene.cast?.length);
  return (
    <SceneFrame
      index={index}
      total={total}
      accent={accent}
      source={spec.source}
      kicker={scene.heading ? undefined : "정리하면"}
      narration={scene.narration}
      english={scene.english}
    >
      {scene.heading ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 112 }}>
          <Heading text={scene.heading} accent={accent} delay={2} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 140,
          right: hasCast ? 540 : 140,
          top: 240,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {scene.points.slice(0, 4).map((p, i) => (
          <RecapRow key={i} n={i + 1} text={p} color={accent} delay={8 + i * 22} />
        ))}
      </div>

      {hasCast ? (
        <div style={{ position: "absolute", right: 110, bottom: 262 }}>
          <StageChar
            cast={scene.cast![0]}
            characters={spec.characters}
            height={scene.cast![0].height ?? 420}
            delay={10}
          />
        </div>
      ) : null}
    </SceneFrame>
  );
};

const RecapRow: React.FC<{ n: number; text: string; color: string; delay: number }> = ({
  n,
  text,
  color,
  delay,
}) => {
  const rise = useRise(delay, 22);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: theme.panel,
        border: `5px solid ${theme.line}`,
        borderRadius: 20,
        padding: "20px 28px",
        boxShadow: `0 8px 0 ${theme.shadow}`,
        ...rise,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: color,
          border: `4px solid ${theme.line}`,
          color: "#FFFFFF",
          fontFamily: theme.font,
          fontSize: 34,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontFamily: theme.font,
          fontSize: fitFont(text, 42, 38, 26),
          fontWeight: 700,
          color: theme.ink,
          lineHeight: 1.35,
          wordBreak: "keep-all",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 디스패처

export const RenderScene: React.FC<{
  scene: Scene;
  spec: VideoSpec;
  index: number;
  total: number;
  accent: string;
}> = (outer) => {
  const { fps } = useVideoConfig();
  // 길이 계산(duration.ts)과 똑같은 창구를 써야 자막과 목소리가 어긋나지 않는다
  const track = voiceTrack(outer.spec, outer.index, fps);
  const props = { ...outer, track };
  const { scene } = props;

  const body = (() => {
    switch (scene.type) {
      case "title":
        return <TitleScene {...props} scene={scene} />;
      case "hook":
        return <HookScene {...props} scene={scene} />;
      case "dialogue":
        return <DialogueScene {...props} scene={scene} />;
      case "story":
        return <StoryScene {...props} scene={scene} />;
      case "concept":
        return <ConceptScene {...props} scene={scene} />;
      case "compare":
        return <CompareScene {...props} scene={scene} />;
      case "flow":
        return <FlowScene {...props} scene={scene} />;
      case "bars":
        return <BarsScene {...props} scene={scene} />;
      case "analogy":
        return <AnalogyScene {...props} scene={scene} />;
      case "quote":
        return <QuoteScene {...props} scene={scene} />;
      case "recap":
        return <RecapScene {...props} scene={scene} />;
      default:
        return null;
    }
  })();

  return (
    <>
      {/* 3인칭 나레이션은 모든 씬이 공통으로 씬 시작과 함께 재생한다 */}
      <Voice track={track} id="narration" at={0} />
      {body}
    </>
  );
};
