import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { Brand } from "./types";
import { theme } from "./theme";
import { shade } from "./Character";

// 길이는 duration.ts 와 공유한다 (스틸 스크립트도 이 값을 알아야 한다)
export { INTRO_FRAMES } from "./duration";
import { INTRO_FRAMES } from "./duration";

/**
 * 학원 로고 인트로.
 * public/ 에 로고 파일을 두고 brand.json 의 logo 에 파일명을 적으면 그 이미지를,
 * 없으면 학원명 이니셜로 만든 모노그램을 보여 준다.
 */
export const BrandIntro: React.FC<{ brand: Brand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = brand.color ?? theme.coral;

  const logoIn = spring({ frame, fps, config: { damping: 12, mass: 0.6, stiffness: 120 } });
  const nameIn = spring({ frame: frame - 12, fps, config: { damping: 200 } });
  const lineIn = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const tagIn = spring({ frame: frame - 28, fps, config: { damping: 200 } });

  // 마지막 8프레임 동안 살짝 밝게 날아가며 본편으로 넘어간다
  const out = interpolate(frame, [INTRO_FRAMES - 9, INTRO_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 로고 파일이 없을 때 쓰는 대체 표기.
  // "T&BEDU" 처럼 짧은 영문명은 두 글자만 따면 이상해지므로 통째로 넣는다.
  const bare = brand.name.replace(/\s/g, "");
  const initial = bare.length <= 6 ? bare : [...bare].slice(0, 2).join("");

  return (
    <AbsoluteFill style={{ background: theme.bg, opacity: out }}>
      {/* 브랜드 색 무드 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 58% at 50% 44%, ${color}2E, transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.45,
          backgroundImage: `radial-gradient(${theme.inkSoft}22 1.6px, transparent 1.7px)`,
          backgroundSize: "34px 34px",
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 30,
        }}
      >
        {/* 로고 */}
        <div
          style={{
            opacity: Math.min(1, logoIn * 1.5),
            transform: `scale(${0.7 + logoIn * 0.3})`,
          }}
        >
          {brand.logo ? (
            // 배경이 투명한 로고를 그대로 세운다 (카드로 감싸면 배지 위 배지처럼 보인다)
            <Img
              src={staticFile(brand.logo)}
              style={{
                height: 300,
                maxWidth: 900,
                objectFit: "contain",
                filter: `drop-shadow(0 12px 14px ${theme.shadow})`,
              }}
            />
          ) : (
            <div
              style={{
                width: 260,
                height: 260,
                borderRadius: "50%",
                background: color,
                border: `8px solid ${theme.line}`,
                boxShadow: `0 14px 0 ${theme.shadow}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: theme.font,
                fontSize: initial.length > 1 ? 108 : 140,
                fontWeight: 900,
                color: "#FFFFFF",
                letterSpacing: -4,
              }}
            >
              {initial}
            </div>
          )}
        </div>

        {/* 학원명 */}
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 76,
            fontWeight: 900,
            color: theme.ink,
            letterSpacing: -2.5,
            opacity: nameIn,
            transform: `translateY(${(1 - nameIn) * 22}px)`,
            textAlign: "center",
            wordBreak: "keep-all",
          }}
        >
          {brand.name}
        </div>

        {/* 밑줄이 좌우로 열린다 */}
        <div
          style={{
            width: 420 * lineIn,
            height: 10,
            borderRadius: 999,
            background: color,
          }}
        />

        {brand.tagline ? (
          <div
            style={{
              fontFamily: theme.font,
              fontSize: 36,
              fontWeight: 700,
              color: theme.inkSoft,
              opacity: tagIn,
              transform: `translateY(${(1 - tagIn) * 16}px)`,
              textAlign: "center",
              maxWidth: 1200,
              wordBreak: "keep-all",
            }}
          >
            {brand.tagline}
          </div>
        ) : null}
      </AbsoluteFill>

      {/* 아래쪽 브랜드 색 띠 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: 22,
          background: `linear-gradient(90deg, ${color}, ${shade(color, 46)})`,
        }}
      />
    </AbsoluteFill>
  );
};
