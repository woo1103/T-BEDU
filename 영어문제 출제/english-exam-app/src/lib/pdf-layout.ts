/**
 * PDF 단(column) 배치용 텍스트 측정 + 패킹.
 * react-pdf는 CSS 다단을 지원하지 않으므로, 문항 높이를 미리 계산해 단에 채워 넣는다.
 * 글자 폭은 public/fonts/NotoSansKR-*.ttf 의 실제 advance width(1em 기준)를 측정한 값.
 */

// ASCII 32~126 의 advance width (em). fontkit으로 NotoSansKR에서 측정.
const ASCII_REGULAR = [0.224,0.323,0.474,0.555,0.555,0.921,0.68,0.278,0.338,0.338,0.467,0.555,0.278,0.347,0.278,0.392,0.555,0.555,0.555,0.555,0.555,0.555,0.555,0.555,0.555,0.555,0.278,0.278,0.555,0.555,0.555,0.474,0.946,0.608,0.657,0.638,0.688,0.589,0.552,0.689,0.728,0.293,0.535,0.646,0.543,0.812,0.723,0.742,0.633,0.742,0.635,0.596,0.599,0.721,0.575,0.878,0.573,0.531,0.603,0.338,0.392,0.338,0.555,0.559,0.606,0.563,0.618,0.51,0.62,0.554,0.325,0.564,0.607,0.275,0.275,0.552,0.284,0.926,0.61,0.606,0.62,0.62,0.388,0.468,0.377,0.607,0.521,0.802,0.498,0.521,0.475,0.338,0.27,0.338,0.555];
const ASCII_BOLD = [0.227,0.37,0.574,0.59,0.59,0.963,0.74,0.325,0.378,0.378,0.507,0.59,0.325,0.37,0.325,0.387,0.59,0.59,0.59,0.59,0.59,0.59,0.59,0.59,0.59,0.59,0.325,0.325,0.59,0.59,0.59,0.514,1.007,0.641,0.681,0.656,0.714,0.615,0.585,0.717,0.757,0.33,0.568,0.686,0.578,0.853,0.749,0.77,0.667,0.77,0.682,0.624,0.625,0.748,0.619,0.915,0.627,0.58,0.613,0.378,0.387,0.378,0.59,0.567,0.626,0.591,0.644,0.527,0.644,0.581,0.372,0.597,0.64,0.304,0.306,0.604,0.315,0.964,0.641,0.626,0.644,0.644,0.437,0.495,0.421,0.637,0.576,0.863,0.562,0.574,0.511,0.378,0.296,0.378,0.59];
// NotoSerifKR(OTF) — 모의고사 양식용
const SERIF_ASCII_REGULAR = [0.256,0.308,0.376,0.574,0.55,0.923,0.779,0.196,0.364,0.364,0.478,0.58,0.327,0.346,0.327,0.352,0.557,0.471,0.558,0.557,0.555,0.558,0.558,0.549,0.558,0.562,0.327,0.327,0.58,0.58,0.58,0.432,0.912,0.718,0.67,0.691,0.77,0.652,0.629,0.741,0.853,0.405,0.403,0.731,0.625,0.975,0.796,0.767,0.641,0.767,0.715,0.567,0.659,0.797,0.714,1.053,0.7,0.687,0.605,0.344,0.352,0.344,0.58,0.563,0.435,0.557,0.638,0.538,0.629,0.547,0.388,0.566,0.663,0.332,0.311,0.607,0.334,0.974,0.661,0.596,0.638,0.607,0.462,0.473,0.367,0.653,0.548,0.838,0.564,0.552,0.498,0.374,0.316,0.374,0.58];
const SERIF_ASCII_BOLD = [0.25,0.355,0.447,0.615,0.589,0.966,0.803,0.235,0.4,0.4,0.485,0.603,0.335,0.37,0.335,0.4,0.593,0.466,0.594,0.593,0.593,0.594,0.594,0.588,0.594,0.596,0.335,0.335,0.603,0.603,0.603,0.473,0.97,0.746,0.708,0.702,0.789,0.666,0.648,0.757,0.864,0.426,0.428,0.767,0.642,1.001,0.815,0.785,0.673,0.785,0.751,0.597,0.695,0.818,0.734,1.091,0.726,0.701,0.627,0.372,0.4,0.372,0.603,0.593,0.447,0.585,0.672,0.565,0.658,0.572,0.402,0.596,0.687,0.349,0.335,0.651,0.355,1.008,0.685,0.623,0.671,0.64,0.5,0.499,0.393,0.678,0.578,0.874,0.599,0.582,0.517,0.38,0.338,0.38,0.603];

export interface FontMetrics {
  ascii: number[];
  asciiBold: number[];
  hangul: number;
}
export const SANS_METRICS: FontMetrics = { ascii: ASCII_REGULAR, asciiBold: ASCII_BOLD, hangul: 0.92 };
export const SERIF_METRICS: FontMetrics = { ascii: SERIF_ASCII_REGULAR, asciiBold: SERIF_ASCII_BOLD, hangul: 0.966 };
const WIDE_EM = 1.0; // 원문자·기호·한자 등

function charEm(code: number, bold: boolean, m: FontMetrics): number {
  if (code >= 32 && code < 127) return (bold ? m.asciiBold : m.ascii)[code - 32];
  if (code >= 0xac00 && code <= 0xd7a3) return m.hangul;
  if (code === 0xa0) return m.ascii[0];
  if (code === 0x2026 || code === 0x2014) return 1.0; // … —
  if (code >= 0x2018 && code <= 0x201d) return 0.278; // 따옴표
  return WIDE_EM;
}

export function textWidth(text: string, fontSize: number, bold = false, metrics: FontMetrics = SANS_METRICS): number {
  let em = 0;
  for (const ch of text) em += charEm(ch.codePointAt(0)!, bold, metrics);
  return em * fontSize;
}

// 하이픈 없이 단어 단위로 줄바꿈했을 때의 줄 수(react-pdf 하이픈 비활성 기준).
// blankWidth: 빈칸 토큰(BLANK_TOKEN) 1개가 차지하는 폭(pt)
export const BLANK_TOKEN = "\u0000";
export function countLines(
  text: string,
  fontSize: number,
  width: number,
  opts: { bold?: boolean; blankWidth?: number; metrics?: FontMetrics; firstLineIndent?: number } = {}
): number {
  if (width <= 0) return 1;
  const m = opts.metrics ?? SANS_METRICS;
  const space = textWidth(" ", fontSize, opts.bold, m);
  let lines = 0;
  for (const para of (text ?? "").split("\n")) {
    lines += 1;
    let x = opts.firstLineIndent ?? 0;
    for (const word of para.split(/ +/)) {
      if (!word) continue;
      const w =
        word === BLANK_TOKEN
          ? opts.blankWidth ?? 0
          : textWidth(word.split(BLANK_TOKEN).join(""), fontSize, opts.bold, m) +
            (word.split(BLANK_TOKEN).length - 1) * (opts.blankWidth ?? 0);
      const need = x === 0 ? w : x + space + w;
      if (need <= width) {
        x = need;
      } else if (w <= width) {
        lines += 1;
        x = w;
      } else {
        // 한 줄보다 긴 단어: 넘치는 만큼 줄 추가
        if (x > 0) lines += 1;
        lines += Math.ceil(w / width) - 1;
        x = w % width;
      }
    }
  }
  return Math.max(1, lines);
}

// ── 단 패킹 ──
export type PackedPage<T> =
  | { kind: "columns"; columns: T[][] }
  | { kind: "oversize"; item: T };

/**
 * 문항을 순서대로 단에 채운다(왼쪽 단 위→아래, 다음 단, 다음 페이지).
 * 한 단에 들어가지 않는 문항만 oversize 페이지(한 페이지 단독)로 보낸다.
 */
export function packColumns<T>(
  items: T[],
  heightOf: (item: T) => number,
  // columnHeight: 고정값 또는 쪽 번호(0부터)별 높이(첫 쪽 머리가 큰 양식 등)
  opts: { columnsPerPage: number; columnHeight: number | ((pageIndex: number) => number); gap: number }
): PackedPage<T>[] {
  const { columnsPerPage, gap } = opts;
  const heightAt = (p: number) =>
    typeof opts.columnHeight === "function" ? opts.columnHeight(p) : opts.columnHeight;
  const pages: PackedPage<T>[] = [];
  let cols: T[][] = [];
  let used = 0; // 현재 단에 쓴 높이

  const flush = () => {
    if (cols.some((c) => c.length > 0)) pages.push({ kind: "columns", columns: cols });
    cols = [];
    used = 0;
  };

  for (const item of items) {
    const h = heightOf(item);
    const columnHeight = heightAt(pages.length);
    if (h > columnHeight) {
      flush();
      pages.push({ kind: "oversize", item });
      continue;
    }
    if (cols.length === 0) cols.push([]);
    const cur = cols[cols.length - 1];
    const need = cur.length === 0 ? h : used + gap + h;
    if (need <= columnHeight) {
      cur.push(item);
      used = need;
      continue;
    }
    // 다음 단으로
    if (cols.length < columnsPerPage) {
      cols.push([item]);
    } else {
      flush();
      cols.push([item]);
    }
    used = h;
  }
  flush();
  return pages;
}
