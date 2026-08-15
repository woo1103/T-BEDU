import React from "react";
import { Composition } from "remotion";
import { PassageVideo } from "./Video";
import { totalFrames } from "./scenes";
import { FPS, HEIGHT, WIDTH } from "./theme";
import type { VideoSpec } from "./types";
import sample from "../input/sample-academic.json";

/**
 * 렌더 시 `--props=input/<slug>.json` 으로 지문별 스펙을 넣는다.
 * 길이는 씬 나레이션 길이에서 자동 계산되므로 따로 지정하지 않아도 된다.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Passage"
    component={PassageVideo}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={600}
    defaultProps={sample as VideoSpec}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalFrames(props as VideoSpec, FPS),
    })}
  />
);
