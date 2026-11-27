// 단어 세트 공용 도구(선생님 화면·API·시험지 인쇄가 같이 쓴다)

export interface VocabRow {
  id?: string; // 이미 저장된 단어면 id(학생 기록을 지키려고 유지)
  word: string;
  meaning: string;
  example?: string | null;
}

const HEADER_WORDS = ["단어", "word", "영어", "english", "voca", "vocabulary"];

// 표(엑셀 행·붙여 넣은 글)를 단어 목록으로. 1열=단어, 2열=뜻, 3열=예문(선택).
// 첫 줄이 머리글(단어/뜻)이면 건너뛴다. 번호 열(1, 2, 3...)이 맨 앞에 있으면 무시한다.
export function rowsToVocab(rows: unknown[][]): VocabRow[] {
  const out: VocabRow[] = [];
  rows.forEach((raw, i) => {
    let cells = raw.map((c) => (c == null ? "" : String(c).trim()));
    // 맨 앞 칸이 번호뿐이면 버린다
    if (cells.length >= 3 && /^\d+\.?$/.test(cells[0])) cells = cells.slice(1);
    const [word = "", meaning = "", example = ""] = cells;
    if (!word || !meaning) return;
    if (i === 0 && HEADER_WORDS.includes(word.toLowerCase())) return;
    out.push({ word, meaning, example: example || null });
  });
  return out;
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
      word: String(r.word ?? "").trim().slice(0, 200),
      meaning: String(r.meaning ?? "").trim().slice(0, 500),
      example: r.example ? String(r.example).trim().slice(0, 1000) : null,
    }))
    .filter((r) => r.word && r.meaning);
}
