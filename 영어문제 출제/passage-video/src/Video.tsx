import React from "react";
import {
  AbsoluteFill,
  Audio,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { VideoSpec } from "./types";
import { RenderScene } from "./scenes";
import { sceneDuration, totalFrames, voiceTrack } from "./duration";
import { accentFor, theme } from "./theme";
import { BrandIntro, INTRO_FRAMES } from "./Intro";

/** 컷이 바뀔 때 6프레임 페이드 — 하드컷보다 눈이 편하다 */
const SoftCut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/**
 * 배경음악. 나레이션을 가리지 않도록 아주 낮은 볼륨으로 깔고,
 * 시작과 끝에서 부드럽게 페이드한다.
 */
const BackgroundMusic: React.FC<{ file: string; volume: number; durationInFrames: number }> = ({
  file,
  volume,
  durationInFrames,
}) => {
  const { fps } = useVideoConfig();
  const fade = Math.round(1.5 * fps);
  return (
    <Audio
      src={staticFile(file)}
      loop
      volume={(f) =>
        interpolate(
          f,
          [0, fade, durationInFrames - fade, durationInFrames],
          [0, volume, volume, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      }
    />
  );
};

export const PassageVideo: React.FC<VideoSpec> = (spec) => {
  const { fps } = useVideoConfig();
  const total = spec.scenes.length;

  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.font }}>
      {spec.brand?.bgm ? (
        <BackgroundMusic
          file={spec.brand.bgm}
          volume={spec.brand.bgmVolume ?? 0.07}
          durationInFrames={totalFrames(spec, fps)}
        />
      ) : null}
      <Series>
        {/* 학원 로고 인트로 — brand.json 이 있으면 자동으로 붙는다 */}
        {spec.brand ? (
          <Series.Sequence durationInFrames={INTRO_FRAMES}>
            <BrandIntro brand={spec.brand} />
          </Series.Sequence>
        ) : null}
        {spec.scenes.map((scene, i) => (
          <Series.Sequence
            key={i}
            durationInFrames={sceneDuration(scene, fps, voiceTrack(spec, i, fps))}
          >
            <SoftCut>
              <RenderScene
                scene={scene}
                spec={spec}
                index={i}
                total={total}
                accent={accentFor(i)}
              />
            </SoftCut>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
