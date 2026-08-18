import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, SUBTITLE_TOP, WIDTH, HEIGHT } from "./theme";
import type { SettingKind } from "./types";
import { shade } from "./Character";

/** 글자 수에 따라 폰트 크기를 줄여 넘침을 막는다 (결정적 계산) */
export const fitFont = (text: string, base: number, maxChars: number, min = 22): number => {
  const len = [...(text ?? "")].length;
  if (len <= maxChars) return base;
  return Math.max(min, Math.round(base * (maxChars / len) ** 0.62));
};

/** 아래에서 살짝 떠오르며 나타나는 애니메이션 */
export const useRise = (delay = 0, distance = 26) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.7 } });
  return {
    opacity: s,
    transform: `translateY(${(1 - s) * distance}px)`,
  };
};

/** 톡 튀어나오는 애니메이션 */
export const usePop = (delay = 0, overshoot = true) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: overshoot ? { damping: 11, mass: 0.55, stiffness: 130 } : { damping: 200 },
  });
  return { opacity: Math.min(1, s * 1.6), transform: `scale(${0.72 + s * 0.28})` };
};

// ─────────────────────────────────────────────── 배경

const Paper: React.FC<{ tint?: string }> = ({ tint }) => (
  <>
    <div style={{ position: "absolute", inset: 0, background: tint ?? theme.bg }} />
    {/* 아주 옅은 점무늬 — 단색 배경보다 화면이 덜 비어 보인다 */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.5,
        backgroundImage: `radial-gradient(${theme.inkSoft}22 1.6px, transparent 1.7px)`,
        backgroundSize: "34px 34px",
      }}
    />
  </>
);

/** 장면 배경 그림 (스토리텔링 지문에서 상황을 알려준다) */
export const Setting: React.FC<{ kind?: SettingKind; accent: string }> = ({
  kind = "plain",
  accent,
}) => {
  const floorY = 720;
  const floor = (color: string) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: floorY,
        height: HEIGHT - floorY,
        background: color,
        borderTop: `4px solid ${theme.line}`,
      }}
    />
  );

  if (kind === "plain") {
    // 단색 원을 깔면 화면 가운데 회색 덩어리처럼 보인다.
    // 경계가 없는 방사형 그라데이션으로 은근하게 깔아 준다.
    return (
      <>
        <Paper />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(60% 55% at 50% 42%, ${accent}22, transparent 70%)`,
          }}
        />
      </>
    );
  }

  if (kind === "night") {
    return (
      <>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(#1B2140, #3A3A62)" }} />
        {[
          [180, 140], [420, 90], [700, 190], [1150, 120], [1480, 170], [1750, 100],
          [320, 260], [980, 260], [1620, 280],
        ].map(([x, y], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: i % 3 === 0 ? 10 : 6,
              height: i % 3 === 0 ? 10 : 6,
              borderRadius: "50%",
              background: "#FFF3C4",
              opacity: 0.9,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            right: 190,
            top: 120,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "#FFF3C4",
            boxShadow: "0 0 70px #FFF3C480",
          }}
        />
        {floor("#232A4A")}
      </>
    );
  }

  if (kind === "classroom") {
    return (
      <>
        <Paper tint="#EFEAF7" />
        {/* 칠판 */}
        <div
          style={{
            position: "absolute",
            left: 210,
            top: 150,
            width: 1500,
            height: 420,
            background: "#2E4A3E",
            border: `10px solid ${shade(theme.amber, -40)}`,
            borderRadius: 10,
            boxShadow: `0 14px 0 ${theme.shadow}`,
          }}
        />
        {floor("#E2D2B6")}
      </>
    );
  }

  if (kind === "room") {
    // 인물은 화면 좌우 끝에, 말풍선은 위쪽에 온다.
    // 창문·액자는 가운데 아래쪽 띠에만 두어 어느 것과도 겹치지 않게 한다.
    return (
      <>
        <Paper tint="#F3EBDD" />
        {/* 창문 */}
        <div
          style={{
            position: "absolute",
            left: 560,
            top: 330,
            width: 340,
            height: 280,
            background: "#CDE8F5",
            border: `8px solid ${theme.line}`,
            borderRadius: 8,
          }}
        />
        <div style={{ position: "absolute", left: 726, top: 330, width: 8, height: 280, background: theme.line }} />
        <div style={{ position: "absolute", left: 560, top: 464, width: 340, height: 8, background: theme.line }} />
        {/* 액자 */}
        <div
          style={{
            position: "absolute",
            left: 1030,
            top: 360,
            width: 220,
            height: 170,
            background: accent,
            opacity: 0.45,
            border: `8px solid ${theme.line}`,
            borderRadius: 6,
          }}
        />
        {floor("#D8B98C")}
      </>
    );
  }

  if (kind === "library") {
    return (
      <>
        <Paper tint="#F0E7D6" />
        {[0, 1].map((row) => (
          <div key={row} style={{ position: "absolute", left: 150, top: 160 + row * 230, display: "flex", gap: 8 }}>
            {Array.from({ length: 26 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 42,
                  height: 170,
                  marginTop: (i * 7 + row * 11) % 26,
                  background: [theme.coral, theme.blue, theme.green, theme.amber, theme.purple][(i + row) % 5],
                  border: `4px solid ${theme.line}`,
                  borderRadius: 4,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        ))}
        {floor("#C9A87C")}
      </>
    );
  }

  if (kind === "lab") {
    // 캐릭터가 서는 하단 중앙을 비워 두고, 벽면 상단에만 장식을 둔다
    return (
      <>
        <Paper tint="#E8F1F6" />
        {/* 말풍선이 오른쪽 위를 쓰므로 장식은 왼쪽 벽에만 둔다 */}
        {[150, 330].map((y, i) => (
          <div
            key={y}
            style={{
              position: "absolute",
              left: 110,
              top: y,
              width: 220,
              height: 150,
              background: "#FFFFFF",
              border: `6px solid ${theme.line}`,
              borderRadius: 10,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-around",
              padding: 12,
            }}
          >
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                style={{
                  width: 34,
                  height: 54 + ((i + j) % 3) * 22,
                  background: [theme.green, theme.teal, theme.amber][(i + j) % 3],
                  border: `4px solid ${theme.line}`,
                  borderRadius: "4px 4px 8px 8px",
                }}
              />
            ))}
          </div>
        ))}
        {floor("#CFDCE4")}
      </>
    );
  }

  if (kind === "market") {
    return (
      <>
        <Paper tint="#F7EBD6" />
        {/* 천막 */}
        <div style={{ position: "absolute", left: 180, top: 130, display: "flex" }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 112,
                height: 90,
                background: i % 2 === 0 ? theme.coral : "#FFFFFF",
                border: `4px solid ${theme.line}`,
                borderRadius: "0 0 56px 56px",
              }}
            />
          ))}
        </div>
        {floor("#D6BB8E")}
      </>
    );
  }

  if (kind === "street") {
    // 캐릭터는 화면 좌우 끝에 선다. 건물은 가운데에만 두어 인물과 겹치지 않게 한다.
    return (
      <>
        <Paper tint="#E9EEF3" />
        {[[430, 3], [700, 2], [970, 4], [1240, 3]].map(([x, floors], i) => {
          const h = 118 * (floors as number);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: floorY - h,
                width: 240,
                height: h,
                background: ["#C7D2DD", "#D9C9BC", "#C2CFC6", "#DCD2E2"][i % 4],
                border: `6px solid ${theme.line}`,
                borderRadius: "8px 8px 0 0",
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
                gap: 18,
                padding: 24,
                boxSizing: "border-box",
              }}
            >
              {Array.from({ length: (floors as number) * 2 }).map((_, w) => (
                <div
                  key={w}
                  style={{
                    width: 78,
                    height: 52,
                    background: (i + w) % 3 === 0 ? theme.amber : "#F2F6F9",
                    border: `4px solid ${theme.line}`,
                    borderRadius: 4,
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
          );
        })}
        {floor("#9EA9B4")}
      </>
    );
  }

  // outdoor
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(#CFEBFA, #EAF6E4)" }} />
      <div
        style={{
          position: "absolute",
          right: 200,
          top: 110,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: theme.amber,
          border: `6px solid ${theme.line}`,
        }}
      />
      {[[240, 640, 170], [1500, 620, 200], [900, 660, 140]].map(([x, y, r], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: (x as number) - (r as number),
            top: (y as number) - (r as number) / 2,
            width: (r as number) * 2,
            height: r as number,
            background: "#7FBF6A",
            border: `6px solid ${theme.line}`,
            borderRadius: `${r}px ${r}px 0 0`,
          }}
        />
      ))}
      {floor("#8FCB77")}
    </>
  );
};

// ─────────────────────────────────────────────── 말풍선

export const Bubble: React.FC<{
  text: string;
  /** 꼬리가 붙는 방향 */
  tail: "left" | "right";
  color?: string;
  width?: number;
  delay?: number;
  /** 생각풍선 모양 */
  thought?: boolean;
}> = ({ text, tail, color = theme.panel, width = 620, delay = 0, thought = false }) => {
  const pop = usePop(delay);
  const size = fitFont(text, 44, 46, 26);
  return (
    <div style={{ position: "relative", width, ...pop }}>
      <div
        style={{
          background: color,
          border: `5px solid ${theme.line}`,
          borderRadius: thought ? 60 : 28,
          padding: "26px 32px",
          fontFamily: theme.font,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.4,
          color: theme.ink,
          boxShadow: `0 10px 0 ${theme.shadow}`,
          wordBreak: "keep-all",
        }}
      >
        {text}
      </div>
      {thought ? (
        <>
          <div
            style={{
              position: "absolute",
              bottom: -34,
              [tail === "left" ? "left" : "right"]: 54,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: color,
              border: `5px solid ${theme.line}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -62,
              [tail === "left" ? "left" : "right"]: 34,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: color,
              border: `4px solid ${theme.line}`,
            }}
          />
        </>
      ) : (
        <svg
          width={64}
          height={46}
          viewBox="0 0 64 46"
          style={{
            position: "absolute",
            bottom: -40,
            [tail === "left" ? "left" : "right"]: 62,
            transform: tail === "left" ? undefined : "scaleX(-1)",
            overflow: "visible",
          }}
        >
          <path
            d="M 4 0 L 60 0 L 10 42 Z"
            fill={color}
            stroke={theme.line}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M 6 0 L 58 0" stroke={color} strokeWidth={8} />
        </svg>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────── 자막

/** 인물이 말하는 순간 자막에 실리는 1인칭 정보 */
export type SpeechBand = {
  name?: string;
  color: string;
  text: string;
  thought?: boolean;
};

/**
 * 하단 자막.
 * 기본은 3인칭 나레이터(어두운 밴드 · 흰 글씨)이고,
 * 인물이 말하는 동안에는 그 인물의 색을 입은 1인칭 대사 밴드로 전환된다.
 */
export const SubtitleBand: React.FC<{
  narration?: string;
  english?: string;
  speech?: SpeechBand;
  /** 나레이션 밴드 왼쪽 강조 막대 색 */
  accent?: string;
}> = ({ narration, english, speech, accent }) => {
  const rise = useRise(3, 18);
  if (!narration && !english && !speech) return null;

  const box: React.CSSProperties = {
    position: "absolute",
    left: 70,
    right: 70,
    top: SUBTITLE_TOP,
    height: HEIGHT - SUBTITLE_TOP - 34,
    borderRadius: 22,
    padding: "18px 36px",
    display: "flex",
    alignItems: "center",
    gap: 22,
    ...rise,
  };

  // ── 1인칭 대사 모드
  if (speech) {
    return (
      <div
        key={speech.text}
        style={{
          ...box,
          background: shade(speech.color, 96),
          border: speech.thought
            ? `5px dashed ${speech.color}`
            : `5px solid ${theme.line}`,
          boxShadow: `0 8px 0 ${theme.shadow}`,
        }}
      >
        {speech.name ? (
          <div
            style={{
              flexShrink: 0,
              background: speech.color,
              color: "#FFFFFF",
              fontFamily: theme.font,
              fontSize: 30,
              fontWeight: 900,
              padding: "8px 22px",
              borderRadius: 999,
              border: `3px solid ${theme.line}`,
              whiteSpace: "nowrap",
            }}
          >
            {speech.name}
            {speech.thought ? " (속마음)" : ""}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: theme.font,
            fontSize: fitFont(speech.text, 48, 40, 30),
            fontWeight: 800,
            color: theme.ink,
            lineHeight: 1.3,
            wordBreak: "keep-all",
            fontStyle: speech.thought ? "italic" : undefined,
          }}
        >
          {speech.thought ? "( " : "「"}
          {speech.text}
          {speech.thought ? " )" : "」"}
        </div>
      </div>
    );
  }

  // ── 3인칭 나레이션 모드
  return (
    <div
      style={{
        ...box,
        background: "rgba(24,28,42,0.93)",
        // 어두운 배경 씬(quote 등)에서도 밴드 경계가 보이도록 강조 막대를 둔다
        borderLeft: `14px solid ${accent ?? theme.coral}`,
        paddingLeft: 30,
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {narration ? (
        <div
          style={{
            fontFamily: theme.font,
            fontSize: fitFont(narration, 46, 52, 28),
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.3,
            wordBreak: "keep-all",
          }}
        >
          {narration}
        </div>
      ) : null}
      {english ? (
        <div
          style={{
            fontFamily: theme.fontEn,
            fontSize: 30,
            fontStyle: "italic",
            color: "#FFD9A0",
            lineHeight: 1.3,
          }}
        >
          {english}
        </div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────── 씬 껍데기

export const SceneFrame: React.FC<{
  index: number;
  total: number;
  accent: string;
  kicker?: string;
  narration?: string;
  english?: string;
  /** 이 프레임에서 인물이 말하는 중이면 자막이 1인칭으로 바뀐다 */
  speech?: SpeechBand;
  /** 지문 출처 — 상단 가운데에 작게 계속 붙는다 */
  source?: string;
  setting?: SettingKind;
  /** 어두운 배경 씬 (자막·진행표시 색을 바꿔야 한다) */
  dark?: boolean;
  /** 배경을 씬이 직접 그릴 때 (title 등) */
  bare?: boolean;
  children: React.ReactNode;
}> = ({
  index,
  total,
  accent,
  kicker,
  narration,
  english,
  speech,
  source,
  setting,
  dark,
  bare,
  children,
}) => {
  const frame = useCurrentFrame();
  // 씬 시작 시 아주 짧은 화면 밀림 — 컷이 바뀐 느낌을 준다
  const slide = interpolate(frame, [0, 10], [16, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: theme.bg }}>
      {bare ? null : <Setting kind={setting ?? "plain"} accent={accent} />}

      <div style={{ position: "absolute", inset: 0, transform: `translateX(${slide}px)` }}>
        {children}
      </div>

      {kicker ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 40,
            background: accent,
            color: "#FFFFFF",
            fontFamily: theme.font,
            fontSize: 30,
            fontWeight: 800,
            padding: "10px 26px",
            borderRadius: 999,
            border: `4px solid ${theme.line}`,
            letterSpacing: -0.5,
          }}
        >
          {kicker}
        </div>
      ) : null}

      {/* 지문 출처 — 어느 지문을 보고 있는지 항상 알 수 있게 */}
      {source ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 48,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: theme.font,
              fontSize: 25,
              fontWeight: 700,
              color: dark ? "rgba(255,255,255,0.62)" : theme.inkSoft,
              background: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.62)",
              border: `2px solid ${dark ? "rgba(255,255,255,0.18)" : "rgba(35,40,56,0.16)"}`,
              borderRadius: 999,
              padding: "5px 22px",
              letterSpacing: -0.3,
              whiteSpace: "nowrap",
            }}
          >
            {source}
          </div>
        </div>
      ) : null}

      {/* 진행 표시 */}
      <div
        style={{
          position: "absolute",
          right: 70,
          top: 46,
          display: "flex",
          gap: 9,
          alignItems: "center",
        }}
      >
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 34 : 13,
              height: 13,
              borderRadius: 999,
              // 밝은 배경과 어두운 배경 모두에서 보이는 회색
              background: i <= index ? accent : "rgba(138,146,168,0.45)",
              border: i <= index ? `2px solid ${theme.line}` : "none",
            }}
          />
        ))}
      </div>

      <SubtitleBand narration={narration} english={english} speech={speech} accent={accent} />
    </div>
  );
};

/** 개념 카드 */
export const Card: React.FC<{
  children: React.ReactNode;
  accent?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, accent, delay = 0, style }) => {
  const pop = usePop(delay);
  return (
    <div
      style={{
        background: theme.panel,
        border: `5px solid ${theme.line}`,
        borderTop: accent ? `18px solid ${accent}` : `5px solid ${theme.line}`,
        borderRadius: 24,
        boxShadow: `0 12px 0 ${theme.shadow}`,
        padding: "28px 32px",
        ...pop,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 아이콘 원판 */
export const IconDisc: React.FC<{ icon?: string; color: string; size?: number; delay?: number }> = ({
  icon,
  color,
  size = 120,
  delay = 0,
}) => {
  const pop = usePop(delay);
  if (!icon) return null;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: `5px solid ${theme.line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.52,
        lineHeight: 1,
        flexShrink: 0,
        ...pop,
      }}
    >
      {icon}
    </div>
  );
};

export const Heading: React.FC<{ text: string; accent: string; delay?: number }> = ({
  text,
  accent,
  delay = 0,
}) => {
  const rise = useRise(delay, 20);
  return (
    <div
      style={{
        fontFamily: theme.font,
        fontSize: fitFont(text, 62, 26, 38),
        fontWeight: 900,
        color: theme.ink,
        letterSpacing: -1.5,
        textAlign: "center",
        wordBreak: "keep-all",
        ...rise,
      }}
    >
      {text}
      <div
        style={{
          height: 12,
          background: accent,
          borderRadius: 999,
          margin: "12px auto 0",
          width: Math.min(560, [...text].length * 30),
          opacity: 0.85,
        }}
      />
    </div>
  );
};

export { WIDTH, HEIGHT };
