// 외부 문항(수능·모의고사 등)의 출처를 한 줄로 만든다. 예: "2025 수능 31번", "2024 9월 평가원 모의평가 33번"
export const SOURCE_KINDS = [
  { key: "suneung", label: "수능", needsMonth: false },
  { key: "kice", label: "평가원 모의평가", needsMonth: true }, // 6월·9월
  { key: "office", label: "교육청 학력평가", needsMonth: true }, // 3·4·7·10월 등
  { key: "private", label: "사설 모의고사", needsMonth: false },
  { key: "textbook", label: "교재·문제집", needsMonth: false },
  { key: "school", label: "학교 기출", needsMonth: false },
  { key: "etc", label: "기타", needsMonth: false },
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number]["key"];

export interface SourceParts {
  kind: SourceKind | "";
  year?: string; // 2025
  month?: string; // 9
  grade?: string; // 고1·고2·고3
  number?: string; // 31
  memo?: string; // 사설 이름, 교재 이름, 학교 이름 등
}

export function composeSource(p: SourceParts): string {
  const kind = SOURCE_KINDS.find((k) => k.key === p.kind);
  if (!kind) return (p.memo ?? "").trim();
  const bits: string[] = [];
  if (p.year?.trim()) bits.push(p.year.trim());
  if (p.grade?.trim()) bits.push(p.grade.trim());
  if (kind.needsMonth && p.month?.trim()) bits.push(`${p.month.trim().replace(/월$/, "")}월`);
  // 사설·교재·학교·기타는 이름(메모)을 종류 대신 앞세운다
  if (["private", "textbook", "school", "etc"].includes(kind.key) && p.memo?.trim()) bits.push(p.memo.trim());
  else bits.push(kind.label);
  if (p.number?.trim()) bits.push(`${p.number.trim().replace(/번$/, "")}번`);
  return bits.join(" ");
}
