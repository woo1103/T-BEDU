/** 영상 전체가 하나의 시리즈처럼 보이도록 색·글꼴을 한 곳에 모아둔다. */

export const theme = {
  /** 따뜻한 종이색 배경 — 교실 프로젝터에서 눈이 편하다 */
  bg: "#F6F1E7",
  bgAlt: "#EFE7D8",
  panel: "#FFFFFF",
  ink: "#232838",
  inkSoft: "#5D677E",
  line: "#232838",
  shadow: "rgba(35,40,56,0.16)",

  coral: "#FF6B4A",
  blue: "#3B82F6",
  green: "#1FA97A",
  amber: "#F2B233",
  purple: "#7C5CE0",
  pink: "#F2679B",
  teal: "#17A2B8",

  font:
    "'Pretendard Variable', Pretendard, 'Noto Sans KR', 'Malgun Gothic', " +
    "'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
  fontEn:
    "'Georgia', 'Iowan Old Style', 'Times New Roman', serif",
} as const;

/** 씬 인덱스별로 돌아가는 강조색 — 화면이 단조로워지지 않게 */
export const accentFor = (index: number): string => {
  const cycle = [theme.coral, theme.blue, theme.green, theme.purple, theme.amber, theme.teal];
  return cycle[index % cycle.length];
};

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

/** 자막 밴드가 차지하는 영역 */
export const SUBTITLE_TOP = 852;
/** 무대(그림)가 쓸 수 있는 영역 */
export const STAGE = { top: 96, bottom: SUBTITLE_TOP - 24 } as const;
