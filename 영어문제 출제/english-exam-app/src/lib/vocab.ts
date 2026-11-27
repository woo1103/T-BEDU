// 단어 세트 공용 도구(선생님 화면·API·시험지 인쇄가 같이 쓴다)

export interface VocabRow {
  id?: string; // 이미 저장된 단어면 id(학생 기록을 지키려고 유지)
  part?: number; // 범위(Day·Unit) 번호, 1부터
  word: string;
  meaning: string;
  example?: string | null;
}

const HEADER_WORDS = ["단어", "word", "영어", "english", "voca", "vocabulary"];
const PART_HEADERS = ["범위", "day", "unit", "part", "세트", "회차", "lesson", "과"];

// "3", "Day 3", "Unit 03", "3과" → 3
function partNumber(cell: string): number | null {
  const m = cell.match(/^(?:day|unit|part|lesson|set)?\s*0*(\d{1,4})\s*(?:과|회|일차?)?\.?$/i);
  return m ? Number(m[1]) : null;
}

// 표(엑셀 행·붙여 넣은 글)를 단어 목록으로. 기본은 1열=단어, 2열=뜻, 3열=예문(선택).
// 맨 앞 열이 숫자이면:
//  - 같은 숫자가 되풀이되거나(1,1,2,2…) "Day 3"처럼 쓰였거나 머리글이 "범위·Day·Unit"이면 → 범위 열
//  - 1,2,3…처럼 줄마다 하나씩 늘어나는 번호면 → 단어 번호라 버린다
// 첫 줄이 머리글이면 건너뛴다.
export function rowsToVocab(rows: unknown[][]): VocabRow[] {
  const table = rows.map((raw) => raw.map((c) => (c == null ? "" : String(c).trim())));
  const header = table[0]?.map((c) => c.toLowerCase()) ?? [];
  const hasHeader =
    HEADER_WORDS.includes(header[0] ?? "") || HEADER_WORDS.includes(header[1] ?? "") || PART_HEADERS.includes(header[0] ?? "") || header[0] === "번호" || header[0] === "no";
  const body = hasHeader ? table.slice(1) : table;

  // 맨 앞 열을 범위로 볼지, 번호로 볼지, 단어로 볼지
  const firsts = body.filter((c) => c.length >= 3 && c[1] && c[2]).map((c) => c[0]);
  const nums = firsts.map(partNumber);
  const allNumeric = firsts.length > 0 && nums.every((n) => n !== null);
  const repeats = allNumeric && new Set(nums).size < nums.length;
  const labeled = firsts.some((c) => /[a-z가-힣]/i.test(c));
  const firstCol: "part" | "number" | "word" = !allNumeric
    ? "word"
    : PART_HEADERS.includes(header[0] ?? "") || repeats || labeled
      ? "part"
      : "number";

  const out: VocabRow[] = [];
  for (const cells of body) {
    let c = cells;
    let part: number | undefined;
    if (firstCol !== "word" && c.length >= 3 && partNumber(c[0]) !== null) {
      if (firstCol === "part") part = partNumber(c[0]) ?? undefined;
      c = c.slice(1);
    }
    const [word = "", meaning = "", example = ""] = c;
    if (!word || !meaning) continue;
    out.push({ word, meaning, example: example || null, ...(part ? { part } : {}) });
  }
  return out;
}

// 범위가 없으면 n단어씩 1, 2, 3… 범위로 나눈다
export function splitIntoParts(rows: VocabRow[], size: number): VocabRow[] {
  const n = Math.max(1, Math.floor(size));
  return rows.map((r, i) => ({ ...r, part: Math.floor(i / n) + 1 }));
}

// 범위 번호 목록(작은 순)과 범위별 단어 수
export function partsOf<T extends { part?: number | null }>(rows: T[]): { part: number; count: number }[] {
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.part ?? 1, (m.get(r.part ?? 1) ?? 0) + 1);
  return [...m].sort((a, b) => a[0] - b[0]).map(([part, count]) => ({ part, count }));
}

// 붙여 넣은 글: 탭(엑셀 복사)·쉼표·" - "·":" 로 단어와 뜻을 나눈다
export function parseVocabText(text: string): VocabRow[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("\t")) return line.split("\t");
      const m = line.match(/^(.+?)\s*(?:,|\s-\s|:|=)\s*(.+)$/);
      return m ? [m[1], m[2]] : [line];
    });
  return rowsToVocab(rows);
}

// 같은 시드면 같은 순서(시험지와 답지가 같은 순서로 나오게)
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const a = [...items];
  let s = seed >>> 0 || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 저장 전 정리: 앞뒤 공백, 빈 줄 제거, 길이 제한
export function cleanVocab(rows: VocabRow[]): VocabRow[] {
  return rows
    .map((r) => ({
      id: r.id,
      part: Number.isInteger(r.part) && (r.part as number) > 0 ? Math.min(9999, r.part as number) : 1,
      word: String(r.word ?? "").trim().slice(0, 200),
      meaning: String(r.meaning ?? "").trim().slice(0, 500),
      example: r.example ? String(r.example).trim().slice(0, 1000) : null,
    }))
    .filter((r) => r.word && r.meaning);
}
