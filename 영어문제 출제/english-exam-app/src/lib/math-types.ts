// 수학 유형코드표(2022 개정, 초1-1 ~ 고등 선택과목). 원자료: 선생님이 정리한 학년별 유형 정리 PDF 3개.
// 코드 = {과정}-{단원 2자리}-{유형 2자리}. 예: M1-1-01-07 = 중1-1 · 1단원 · 7번 유형.
// 과정 코드: 초 E1-1~E6-2, 중 M1-1~M3-2, 고 HC1(공통수학1) HC2 HAL(대수) HCA1(미적분Ⅰ) HCA2(미적분Ⅱ) HGE(기하) HPS(확률과 통계)
// 데이터가 커서(약 330KB) 서버에서만 불러오고, 화면은 /api/math-types 로 받는다.
import data from "@/data/math-types.json";

export interface MathTypeItem {
  code: string;
  no: number;
  area: string; // 영역(단원 안 묶음)
  name: string;
  optional?: boolean; // 교재·출판사에 따라 포함 여부가 다른 유형(PDF의 * 표시)
}
export interface MathTypeUnit {
  code: string;
  no: number;
  name: string;
  types: MathTypeItem[];
}
export interface MathTypeCourse {
  code: string;
  level: string; // 초등부 | 중등부 | 고등부
  grade: string; // 초1 … 고3
  semester: number | null;
  name: string; // 짧은 이름: 중1-1, 공통수학1
  title: string;
  units: MathTypeUnit[];
}

export const MATH_TYPES = data as { version: string; courses: MathTypeCourse[] };

export interface ResolvedType {
  course: MathTypeCourse;
  unit: MathTypeUnit;
  type: MathTypeItem;
}

let index: Map<string, ResolvedType> | null = null;
function byCode() {
  if (!index) {
    index = new Map();
    for (const course of MATH_TYPES.courses)
      for (const unit of course.units) for (const type of unit.types) index.set(type.code, { course, unit, type });
  }
  return index;
}

export function findMathType(code: string | null | undefined): ResolvedType | null {
  return code ? byCode().get(code.trim()) ?? null : null;
}

// 사람이 읽는 한 줄: "중1-1 · 1. 소인수분해 · 소인수분해하기 (가지치기, 나눗셈)"
export function mathTypeLabel(code: string | null | undefined): string {
  const r = findMathType(code);
  return r ? `${r.course.name} · ${r.unit.no}. ${r.unit.name} · ${r.type.name}` : "";
}

// 과정·단원 코드도 받는 필터: 유형 코드면 그 유형만, 과정/단원 코드면 그 아래 전체
export function typeCodeFilter(code: string): { equals: string } | { startsWith: string } {
  return findMathType(code) ? { equals: code } : { startsWith: `${code}-` };
}
