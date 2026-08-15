import React from "react";
import { useCurrentFrame } from "remotion";
import type {
  Accessory,
  Build,
  CharacterPreset,
  Expression,
  HairStyle,
  HeldProp,
  Pose,
} from "./types";
import { theme } from "./theme";

/**
 * 파라미터 조합형 만화 캐릭터.
 * 머리·피부·옷·소품·표정·포즈를 조합하므로 지문마다 새 인물을 만들 수 있으면서
 * 그림 스타일은 시리즈 전체에서 일정하게 유지된다.
 */

const VB_W = 220;
const VB_H = 380;

// 머리 기준점
const HX = 110;
const HY = 108;
const HRX = 58;
const HRY = 60;

const OUTLINE = "#232838";
const SW = 3.4; // 외곽선 두께

const buildHalfWidth = (build: Build): number =>
  build === "slim" ? 38 : build === "stout" ? 53 : 45;

/** 문자열 → 안정적인 정수 (눈 깜빡임 위상을 캐릭터별로 다르게) */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
};

// ─────────────────────────────────────────────── 머리카락

const hairBack = (style: HairStyle, color: string): React.ReactNode => {
  const dark = shade(color, -18);
  switch (style) {
    case "long":
      return (
        <>
          <path
            d={`M ${HX - HRX - 6} ${HY - 10} Q ${HX - HRX - 16} ${HY + 130} ${HX - HRX + 6} ${HY + 150}
                L ${HX + HRX - 6} ${HY + 150} Q ${HX + HRX + 16} ${HY + 130} ${HX + HRX + 6} ${HY - 10} Z`}
            fill={dark}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
        </>
      );
    case "bob":
      return (
        <path
          d={`M ${HX - HRX - 5} ${HY - 14} Q ${HX - HRX - 12} ${HY + 58} ${HX - HRX + 4} ${HY + 70}
              L ${HX + HRX - 4} ${HY + 70} Q ${HX + HRX + 12} ${HY + 58} ${HX + HRX + 5} ${HY - 14} Z`}
          fill={dark}
          stroke={OUTLINE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      );
    case "braids":
      return (
        <>
          {[-1, 1].map((s) => (
            <g key={s}>
              <path
                d={`M ${HX + s * (HRX - 4)} ${HY + 18} Q ${HX + s * (HRX + 20)} ${HY + 70} ${HX + s * (HRX + 8)} ${HY + 120}`}
                fill="none"
                stroke={dark}
                strokeWidth={20}
                strokeLinecap="round"
              />
              <circle
                cx={HX + s * (HRX + 9)}
                cy={HY + 124}
                r={8}
                fill={theme.coral}
                stroke={OUTLINE}
                strokeWidth={2.6}
              />
            </g>
          ))}
        </>
      );
    case "ponytail":
      return (
        <>
          <path
            d={`M ${HX + HRX - 10} ${HY - 22} Q ${HX + HRX + 44} ${HY + 6} ${HX + HRX + 24} ${HY + 76}
                Q ${HX + HRX + 6} ${HY + 40} ${HX + HRX - 16} ${HY + 22} Z`}
            fill={dark}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          <circle
            cx={HX + HRX - 12}
            cy={HY - 18}
            r={8}
            fill={theme.amber}
            stroke={OUTLINE}
            strokeWidth={2.6}
          />
        </>
      );
    default:
      return null;
  }
};

const hairFront = (style: HairStyle, color: string): React.ReactNode => {
  if (style === "bald") {
    return (
      <path
        d={`M ${HX - 26} ${HY - HRY + 16} Q ${HX - 8} ${HY - HRY + 4} ${HX + 8} ${HY - HRY + 12}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.75}
      />
    );
  }

  // 모든 스타일이 공유하는 "정수리 + 앞머리" 덩어리
  const cap = (
    <path
      d={`M ${HX - HRX - 1} ${HY + 6}
          A ${HRX + 1} ${HRY + 2} 0 0 1 ${HX + HRX + 1} ${HY + 6}
          Q ${HX + HRX * 0.55} ${HY - HRY * 0.34} ${HX + 4} ${HY - HRY * 0.1}
          Q ${HX - HRX * 0.5} ${HY - HRY * 0.02} ${HX - HRX - 1} ${HY + 6} Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
  );

  const extra = (() => {
    switch (style) {
      case "spiky":
        return (
          <path
            d={`M ${HX - 46} ${HY - HRY + 10}
                l 12 -22 l 10 18 l 12 -26 l 11 22 l 13 -20 l 9 20`}
            fill={color}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
        );
      case "bun":
        return (
          <circle
            cx={HX}
            cy={HY - HRY - 14}
            r={22}
            fill={color}
            stroke={OUTLINE}
            strokeWidth={SW}
          />
        );
      case "curly":
        return (
          <>
            {[-46, -22, 2, 26, 48].map((dx, i) => (
              <circle
                key={dx}
                cx={HX + dx}
                cy={HY - HRY + (i % 2 === 0 ? 6 : -4)}
                r={17}
                fill={color}
                stroke={OUTLINE}
                strokeWidth={SW}
              />
            ))}
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <>
      {extra}
      {cap}
    </>
  );
};

// ─────────────────────────────────────────────── 표정

type FaceOpts = { expression: Expression; eyeOpen: number; mouthOpen: number };

const face = ({ expression, eyeOpen, mouthOpen }: FaceOpts): React.ReactNode => {
  const eyeY = HY + 6;
  const eyeDX = 23;
  const browY = eyeY - 22;

  const eye = (sign: number) => {
    const cx = HX + sign * eyeDX;
    if (expression === "happy" || expression === "excited") {
      // ^^ 웃는 눈
      return (
        <path
          d={`M ${cx - 12} ${eyeY + 3} Q ${cx} ${eyeY - 12} ${cx + 12} ${eyeY + 3}`}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={5}
          strokeLinecap="round"
        />
      );
    }
    if (expression === "surprised") {
      return (
        <g>
          <ellipse cx={cx} cy={eyeY} rx={11} ry={12 * eyeOpen + 1} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={cx} cy={eyeY} r={5.4 * eyeOpen + 0.6} fill={OUTLINE} />
        </g>
      );
    }
    if (expression === "thinking") {
      // 위를 보는 반쯤 감긴 눈
      return (
        <g>
          <ellipse cx={cx} cy={eyeY} rx={9.5} ry={9 * eyeOpen + 0.8} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.6} />
          <circle cx={cx + sign * 2} cy={eyeY - 3.5} r={4.4 * eyeOpen + 0.6} fill={OUTLINE} />
        </g>
      );
    }
    if (expression === "sad") {
      return (
        <g>
          <ellipse cx={cx} cy={eyeY + 2} rx={9.5} ry={9.5 * eyeOpen + 0.8} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.6} />
          <circle cx={cx} cy={eyeY + 4} r={4.4 * eyeOpen + 0.6} fill={OUTLINE} />
        </g>
      );
    }
    // neutral / confused
    return (
      <g>
        <ellipse cx={cx} cy={eyeY} rx={10} ry={10.5 * eyeOpen + 0.8} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.6} />
        <circle cx={cx} cy={eyeY} r={4.8 * eyeOpen + 0.6} fill={OUTLINE} />
        {eyeOpen > 0.6 ? <circle cx={cx + 3} cy={eyeY - 3.4} r={1.9} fill="#FFFFFF" /> : null}
      </g>
    );
  };

  const brow = (sign: number) => {
    const cx = HX + sign * eyeDX;
    let d = `M ${cx - 12} ${browY} Q ${cx} ${browY - 4} ${cx + 12} ${browY}`;
    if (expression === "surprised" || expression === "excited") {
      d = `M ${cx - 12} ${browY - 5} Q ${cx} ${browY - 13} ${cx + 12} ${browY - 5}`;
    } else if (expression === "thinking") {
      d = `M ${cx - 12} ${browY + (sign > 0 ? -5 : 1)} L ${cx + 12} ${browY + (sign > 0 ? 1 : -5)}`;
    } else if (expression === "confused") {
      d =
        sign > 0
          ? `M ${cx - 12} ${browY - 8} L ${cx + 12} ${browY - 1}`
          : `M ${cx - 12} ${browY} Q ${cx} ${browY - 3} ${cx + 12} ${browY}`;
    } else if (expression === "sad") {
      d =
        sign > 0
          ? `M ${cx - 12} ${browY - 6} L ${cx + 12} ${browY + 2}`
          : `M ${cx - 12} ${browY + 2} L ${cx + 12} ${browY - 6}`;
    }
    return <path d={d} fill="none" stroke={OUTLINE} strokeWidth={4.4} strokeLinecap="round" />;
  };

  const mouthY = HY + 36;
  const mouth = (() => {
    const open = mouthOpen; // 0..1
    if (open > 0.05) {
      const h = 6 + open * 15;
      const w = 12 + open * 6;
      return (
        <path
          d={`M ${HX - w} ${mouthY - 2} Q ${HX} ${mouthY + h} ${HX + w} ${mouthY - 2} Q ${HX} ${mouthY + 2} ${HX - w} ${mouthY - 2} Z`}
          fill="#8A3B3B"
          stroke={OUTLINE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      );
    }
    switch (expression) {
      case "happy":
        return (
          <path
            d={`M ${HX - 17} ${mouthY - 3} Q ${HX} ${mouthY + 14} ${HX + 17} ${mouthY - 3}`}
            fill="none"
            stroke={OUTLINE}
            strokeWidth={4.4}
            strokeLinecap="round"
          />
        );
      case "excited":
        return (
          <path
            d={`M ${HX - 18} ${mouthY - 4} Q ${HX} ${mouthY + 20} ${HX + 18} ${mouthY - 4} Z`}
            fill="#8A3B3B"
            stroke={OUTLINE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
        );
      case "surprised":
        return <ellipse cx={HX} cy={mouthY + 3} rx={9} ry={11} fill="#8A3B3B" stroke={OUTLINE} strokeWidth={2.8} />;
      case "sad":
        return (
          <path
            d={`M ${HX - 15} ${mouthY + 6} Q ${HX} ${mouthY - 6} ${HX + 15} ${mouthY + 6}`}
            fill="none"
            stroke={OUTLINE}
            strokeWidth={4.4}
            strokeLinecap="round"
          />
        );
      case "confused":
        return (
          <path
            d={`M ${HX - 14} ${mouthY + 2} q 7 -7 9 0 q 5 6 10 -2`}
            fill="none"
            stroke={OUTLINE}
            strokeWidth={4.2}
            strokeLinecap="round"
          />
        );
      default:
        return (
          <path
            d={`M ${HX - 12} ${mouthY} Q ${HX} ${mouthY + 7} ${HX + 12} ${mouthY}`}
            fill="none"
            stroke={OUTLINE}
            strokeWidth={4.2}
            strokeLinecap="round"
          />
        );
    }
  })();

  const blush =
    expression === "happy" || expression === "excited" ? (
      <>
        {[-1, 1].map((s) => (
          <ellipse key={s} cx={HX + s * 40} cy={HY + 26} rx={11} ry={7} fill={theme.pink} opacity={0.4} />
        ))}
      </>
    ) : null;

  return (
    <>
      {blush}
      {brow(-1)}
      {brow(1)}
      {eye(-1)}
      {eye(1)}
      {mouth}
    </>
  );
};

// ─────────────────────────────────────────────── 소품 / 액세서리

const accessoryNode = (kind: Accessory, hairColor: string): React.ReactNode => {
  switch (kind) {
    case "glasses":
      return (
        <g fill="none" stroke={OUTLINE} strokeWidth={3.6}>
          <rect x={HX - 40} y={HY - 7} width={32} height={26} rx={7} fill="#FFFFFF" opacity={0.28} />
          <rect x={HX + 8} y={HY - 7} width={32} height={26} rx={7} fill="#FFFFFF" opacity={0.28} />
          <path d={`M ${HX - 8} ${HY + 5} L ${HX + 8} ${HY + 5}`} />
        </g>
      );
    case "roundGlasses":
      return (
        <g fill="none" stroke={OUTLINE} strokeWidth={3.6}>
          <circle cx={HX - 23} cy={HY + 6} r={17} fill="#FFFFFF" opacity={0.28} />
          <circle cx={HX + 23} cy={HY + 6} r={17} fill="#FFFFFF" opacity={0.28} />
          <path d={`M ${HX - 6} ${HY + 6} L ${HX + 6} ${HY + 6}`} />
        </g>
      );
    case "cap":
      return (
        <g stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round">
          <path
            d={`M ${HX - HRX - 2} ${HY - HRY + 26} A ${HRX + 2} ${HRY} 0 0 1 ${HX + HRX + 2} ${HY - HRY + 26} Z`}
            fill={theme.blue}
          />
          <path
            d={`M ${HX + HRX - 6} ${HY - HRY + 26} Q ${HX + HRX + 44} ${HY - HRY + 22} ${HX + HRX + 40} ${HY - HRY + 36}
                Q ${HX + HRX + 10} ${HY - HRY + 38} ${HX + HRX - 8} ${HY - HRY + 34} Z`}
            fill={shade(theme.blue, -14)}
          />
        </g>
      );
    case "hat":
      return (
        <g stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round">
          <ellipse cx={HX} cy={HY - HRY + 22} rx={HRX + 26} ry={11} fill={shade(theme.amber, -12)} />
          <path
            d={`M ${HX - 40} ${HY - HRY + 22} L ${HX - 32} ${HY - HRY - 26} Q ${HX} ${HY - HRY - 36} ${HX + 32} ${HY - HRY - 26} L ${HX + 40} ${HY - HRY + 22} Z`}
            fill={theme.amber}
          />
        </g>
      );
    case "crown":
      return (
        <path
          d={`M ${HX - 34} ${HY - HRY + 14} L ${HX - 34} ${HY - HRY - 22} L ${HX - 14} ${HY - HRY - 4}
              L ${HX} ${HY - HRY - 28} L ${HX + 14} ${HY - HRY - 4} L ${HX + 34} ${HY - HRY - 22}
              L ${HX + 34} ${HY - HRY + 14} Z`}
          fill={theme.amber}
          stroke={OUTLINE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      );
    case "headband":
      return (
        <path
          d={`M ${HX - HRX - 1} ${HY - 12} A ${HRX + 1} ${HRY} 0 0 1 ${HX + HRX + 1} ${HY - 12}`}
          fill="none"
          stroke={theme.coral}
          strokeWidth={12}
          strokeLinecap="round"
        />
      );
    case "earmuffs":
      return (
        <g stroke={OUTLINE} strokeWidth={SW}>
          <path
            d={`M ${HX - HRX + 4} ${HY - 24} A ${HRX - 4} ${HRY - 6} 0 0 1 ${HX + HRX - 4} ${HY - 24}`}
            fill="none"
            strokeWidth={8}
          />
          <ellipse cx={HX - HRX + 2} cy={HY + 4} rx={13} ry={17} fill={shade(hairColor, 30)} />
          <ellipse cx={HX + HRX - 2} cy={HY + 4} rx={13} ry={17} fill={shade(hairColor, 30)} />
        </g>
      );
    default:
      return null;
  }
};

const facialHairNode = (kind: string): React.ReactNode => {
  if (kind === "beard") {
    return (
      <path
        d={`M ${HX - 40} ${HY + 16} Q ${HX - 34} ${HY + HRY + 6} ${HX} ${HY + HRY + 10}
            Q ${HX + 34} ${HY + HRY + 6} ${HX + 40} ${HY + 16}`}
        fill="#4A3B33"
        opacity={0.9}
        stroke={OUTLINE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    );
  }
  if (kind === "mustache") {
    return (
      <path
        d={`M ${HX - 18} ${HY + 26} Q ${HX} ${HY + 18} ${HX + 18} ${HY + 26} Q ${HX} ${HY + 31} ${HX - 18} ${HY + 26} Z`}
        fill="#4A3B33"
        stroke={OUTLINE}
        strokeWidth={2.4}
      />
    );
  }
  return null;
};

const propNode = (kind: HeldProp, x: number, y: number): React.ReactNode => {
  const g = (children: React.ReactNode) => (
    <g transform={`translate(${x} ${y})`} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round">
      {children}
    </g>
  );
  switch (kind) {
    case "book":
      return g(
        <>
          <rect x={-22} y={-14} width={44} height={30} rx={3} fill={theme.coral} />
          <path d="M 0 -14 L 0 16" />
          <rect x={-22} y={-14} width={44} height={5} fill="#FFFFFF" opacity={0.5} stroke="none" />
        </>
      );
    case "flask":
      return g(
        <>
          <path d="M -6 -20 L -6 -6 L -18 16 L 18 16 L 6 -6 L 6 -20 Z" fill="#DCEFFB" />
          <path d="M -13 6 L 13 6 L 18 16 L -18 16 Z" fill={theme.green} />
          <path d="M -9 -22 L 9 -22" strokeWidth={4} />
        </>
      );
    case "coin":
      return g(
        <>
          <circle cx={0} cy={0} r={17} fill={theme.amber} />
          <circle cx={0} cy={0} r={9} fill="none" strokeWidth={2.4} />
        </>
      );
    case "phone":
      return g(<rect x={-11} y={-19} width={22} height={38} rx={4} fill="#2E3550" />);
    case "leaf":
      return g(
        <path d="M 0 18 Q -20 2 -2 -18 Q 18 0 0 18 Z" fill={theme.green} />
      );
    case "pen":
      return g(
        <>
          <path d="M -14 14 L 12 -14" strokeWidth={9} stroke={theme.blue} strokeLinecap="round" />
          <path d="M -14 14 l 6 -2 l -4 -4 Z" fill={OUTLINE} />
        </>
      );
    case "basket":
      return g(
        <>
          <path d="M -20 -6 L -15 18 L 15 18 L 20 -6 Z" fill={shade(theme.amber, -18)} />
          <path d="M -14 -6 Q 0 -26 14 -6" fill="none" />
        </>
      );
    case "lamp":
      return g(
        <>
          <circle cx={0} cy={0} r={15} fill={theme.amber} />
          <path d="M -8 15 L 8 15" strokeWidth={5} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path
              key={a}
              d={`M ${Math.cos((a * Math.PI) / 180) * 21} ${Math.sin((a * Math.PI) / 180) * 21}
                  L ${Math.cos((a * Math.PI) / 180) * 28} ${Math.sin((a * Math.PI) / 180) * 28}`}
              strokeWidth={3.4}
              strokeLinecap="round"
            />
          ))}
        </>
      );
    default:
      return null;
  }
};

// ─────────────────────────────────────────────── 색 보조

/** hex 색을 밝게(+)/어둡게(-) */
export function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 255) + amount);
  const g = clamp(((num >> 8) & 255) + amount);
  const b = clamp((num & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─────────────────────────────────────────────── 본체

export const Character: React.FC<{
  preset: CharacterPreset;
  expression?: Expression;
  pose?: Pose;
  talking?: boolean;
  /** 화면에 그려질 높이 (px) */
  height?: number;
  flip?: boolean;
  /** 깜빡임 위상을 캐릭터별로 다르게 하는 키 */
  seedKey?: string;
}> = ({
  preset,
  expression = "neutral",
  pose = "idle",
  talking = false,
  height = 420,
  flip = false,
  seedKey = "a",
}) => {
  const frame = useCurrentFrame();
  const build = preset.build ?? "normal";
  const w = buildHalfWidth(build);
  const sw = w - 5;
  const cx = HX;

  // 눈 깜빡임: 2.6초 주기, 6프레임 동안 감김
  const phase = (frame + (hash(seedKey) % 70)) % 78;
  const eyeOpen = phase < 4 ? Math.abs(phase - 2) / 2 : 1;

  // 말할 때 입 움직임
  const mouthOpen = talking ? 0.25 + 0.75 * Math.abs(Math.sin(frame * 0.55)) : 0;

  // 숨쉬기 — 상체만 아주 살짝
  const breathe = Math.sin(frame * 0.075) * 2.2;

  const shoulderL = { x: cx - sw + 4, y: 202 };
  const shoulderR = { x: cx + sw - 4, y: 202 };

  // 손 위치는 반드시 머리(HX±HRX) 밖으로 나가야 한다.
  // 안쪽에 두면 머리가 나중에 그려지면서 손이 사라진다.
  const hands: Record<Pose, { l: { x: number; y: number }; r: { x: number; y: number } }> = {
    idle: { l: { x: cx - w - 13, y: 266 }, r: { x: cx + w + 13, y: 266 } },
    point: { l: { x: cx - w - 13, y: 266 }, r: { x: cx + sw + 56, y: 142 } },
    // 머리·묶은머리 옆에 손이 붙으면 "머리를 만지는" 것처럼 보인다. 위로 더 띄운다
    raise: { l: { x: cx - w - 13, y: 266 }, r: { x: cx + sw + 42, y: 44 } },
    shrug: { l: { x: cx - sw - 52, y: 208 }, r: { x: cx + sw + 52, y: 208 } },
    // 턱을 짚는 손 — 머리 오른쪽 윤곽 바로 밖
    think: { l: { x: cx - w - 13, y: 266 }, r: { x: HX + HRX + 10, y: HY + 44 } },
    present: { l: { x: cx - w - 13, y: 266 }, r: { x: cx + sw + 58, y: 216 } },
    cheer: { l: { x: cx - sw - 34, y: 78 }, r: { x: cx + sw + 34, y: 78 } },
  };
  const hand = hands[pose];

  const arm = (s: { x: number; y: number }, h: { x: number; y: number }, bendOut: number) => {
    const mx = (s.x + h.x) / 2 + bendOut;
    const my = (s.y + h.y) / 2 + 10;
    return (
      <path
        d={`M ${s.x} ${s.y} Q ${mx} ${my} ${h.x} ${h.y}`}
        fill="none"
        stroke={preset.outfitColor}
        strokeWidth={22}
        strokeLinecap="round"
      />
    );
  };

  const legColor = preset.accentColor ?? shade(preset.outfitColor, -46);

  // 옷 종류별 상체 장식
  const outfitDetail = (() => {
    switch (preset.outfit) {
      case "labcoat":
        // 가운을 몸통 폭 안쪽으로 좁게 그린다. 넓히면 팔이 가운에 묻혀 사라진다.
        return (
          <>
            <path
              d={`M ${cx - sw + 4} ${200} Q ${cx} ${192} ${cx + sw - 4} ${200} L ${cx + w - 7} ${300} L ${cx - w + 7} ${300} Z`}
              fill="#FFFFFF"
              stroke={OUTLINE}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            <path d={`M ${cx} ${196} L ${cx} ${300}`} stroke={OUTLINE} strokeWidth={2.6} fill="none" />
            <rect x={cx + 10} y={240} width={20} height={17} rx={2} fill="none" stroke={OUTLINE} strokeWidth={2.4} />
          </>
        );
      case "suit":
        return (
          <>
            <path
              d={`M ${cx - 22} ${196} L ${cx} ${232} L ${cx + 22} ${196}`}
              fill="#FFFFFF"
              stroke={OUTLINE}
              strokeWidth={2.6}
            />
            <path
              d={`M ${cx - 8} ${210} L ${cx + 8} ${210} L ${cx + 5} ${252} L ${cx} ${258} L ${cx - 5} ${252} Z`}
              fill={theme.coral}
              stroke={OUTLINE}
              strokeWidth={2.4}
            />
          </>
        );
      case "apron":
        return (
          <>
            <path
              d={`M ${cx - 26} ${208} L ${cx + 26} ${208} L ${cx + 30} ${296} L ${cx - 30} ${296} Z`}
              fill={preset.accentColor ?? "#F3EAD6"}
              stroke={OUTLINE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <path d={`M ${cx - 20} ${208} L ${cx - 8} ${192}`} stroke={OUTLINE} strokeWidth={3} fill="none" />
            <path d={`M ${cx + 20} ${208} L ${cx + 8} ${192}`} stroke={OUTLINE} strokeWidth={3} fill="none" />
          </>
        );
      case "hoodie":
        return (
          <>
            <path
              d={`M ${cx - 30} ${190} Q ${cx} ${216} ${cx + 30} ${190}`}
              fill={shade(preset.outfitColor, -22)}
              stroke={OUTLINE}
              strokeWidth={2.8}
            />
            <path d={`M ${cx - 7} ${212} L ${cx - 9} ${242}`} stroke={OUTLINE} strokeWidth={3.2} fill="none" strokeLinecap="round" />
            <path d={`M ${cx + 7} ${212} L ${cx + 9} ${242}`} stroke={OUTLINE} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          </>
        );
      case "robe":
        return (
          <path
            d={`M ${cx - sw} ${200} L ${cx - w - 12} ${330} L ${cx + w + 12} ${330} L ${cx + sw} ${200} Z`}
            fill={shade(preset.outfitColor, 14)}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
        );
      case "dress":
        return (
          <path
            d={`M ${cx - sw} ${232} L ${cx - w - 20} ${318} L ${cx + w + 20} ${318} L ${cx + sw} ${232} Z`}
            fill={shade(preset.outfitColor, 16)}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
        );
      case "uniform":
        return (
          <>
            <path
              d={`M ${cx - 24} ${194} L ${cx} ${226} L ${cx + 24} ${194}`}
              fill="#FFFFFF"
              stroke={OUTLINE}
              strokeWidth={2.6}
            />
            <path
              d={`M ${cx - 12} ${216} L ${cx + 12} ${216} L ${cx} ${238} Z`}
              fill={theme.blue}
              stroke={OUTLINE}
              strokeWidth={2.4}
            />
          </>
        );
      default:
        return (
          <path
            d={`M ${cx - 26} ${196} Q ${cx} ${214} ${cx + 26} ${196}`}
            fill="none"
            stroke={OUTLINE}
            strokeWidth={2.8}
          />
        );
    }
  })();

  const scale = height / VB_H;

  return (
    <svg
      width={VB_W * scale}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}
    >
      {/* 발밑 그림자 */}
      <ellipse cx={cx} cy={366} rx={w + 30} ry={11} fill={theme.shadow} />

      {/* 다리 */}
      <g stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round">
        <rect x={cx - w + 6} y={272} width={26} height={80} rx={12} fill={legColor} />
        <rect x={cx + w - 32} y={272} width={26} height={80} rx={12} fill={legColor} />
        <ellipse cx={cx - w + 17} cy={356} rx={19} ry={11} fill={OUTLINE} />
        <ellipse cx={cx + w - 19} cy={356} rx={19} ry={11} fill={OUTLINE} />
      </g>

      {/* 뒤쪽 머리카락 */}
      {hairBack(preset.hair, preset.hairColor)}

      <g transform={`translate(0 ${breathe})`}>
        {/* 뒤쪽 팔 (왼팔) */}
        {arm(shoulderL, hand.l, -14)}

        {/* 몸통 */}
        <path
          d={`M ${cx - sw} ${196} Q ${cx} ${186} ${cx + sw} ${196}
              L ${cx + w} ${278} Q ${cx} ${288} ${cx - w} ${278} Z`}
          fill={preset.outfitColor}
          stroke={OUTLINE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
        {outfitDetail}

        {/* 목 */}
        <rect x={cx - 13} y={158} width={26} height={40} rx={9} fill={shade(preset.skin, -16)} stroke={OUTLINE} strokeWidth={SW} />

        {/* 앞쪽 팔 (오른팔) */}
        {arm(shoulderR, hand.r, 14)}
        <circle cx={hand.l.x} cy={hand.l.y} r={12} fill={preset.skin} stroke={OUTLINE} strokeWidth={SW} />
        <circle cx={hand.r.x} cy={hand.r.y} r={12} fill={preset.skin} stroke={OUTLINE} strokeWidth={SW} />

        {/* 손에 든 물건 — 몸통에서 더 바깥으로 빼서 옷에 묻히지 않게 */}
        {preset.prop && preset.prop !== "none"
          ? propNode(preset.prop, hand.l.x - 20, hand.l.y + 2)
          : null}

        {/* 머리 */}
        <g transform={`translate(0 ${breathe * 0.5})`}>
          <ellipse cx={HX} cy={HY} rx={HRX} ry={HRY} fill={preset.skin} stroke={OUTLINE} strokeWidth={SW} />
          {/* 귀 */}
          <ellipse cx={HX - HRX} cy={HY + 8} rx={9} ry={13} fill={preset.skin} stroke={OUTLINE} strokeWidth={SW} />
          <ellipse cx={HX + HRX} cy={HY + 8} rx={9} ry={13} fill={preset.skin} stroke={OUTLINE} strokeWidth={SW} />
          {facialHairNode(preset.facialHair ?? "none")}
          {face({ expression, eyeOpen, mouthOpen })}
          {hairFront(preset.hair, preset.hairColor)}
          {accessoryNode(preset.accessory ?? "none", preset.hairColor)}
        </g>
      </g>
    </svg>
  );
};
