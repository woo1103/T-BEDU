"use client";

import { useEffect, useState } from "react";
import type { MathTypeCourse, MathTypeItem, MathTypeUnit } from "@/lib/math-types";

export interface MathTypesData {
  version: string;
  courses: MathTypeCourse[];
  counts: Record<string, number>; // 유형 코드별 은행 문제 수
}

// 코드표는 크니까 한 번만 받아 두고 여러 화면이 같이 쓴다
let cache: Promise<MathTypesData> | null = null;
export function loadMathTypes(fresh = false): Promise<MathTypesData> {
  if (!cache || fresh) {
    cache = fetch("/api/math-types").then((r) => {
      if (!r.ok) throw new Error("유형코드표를 불러오지 못했어요");
      return r.json();
    });
    cache.catch(() => (cache = null));
  }
  return cache;
}

export function useMathTypes(fresh = false) {
  const [data, setData] = useState<MathTypesData | null>(null);
  useEffect(() => {
    let alive = true;
    loadMathTypes(fresh)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [fresh]);
  return data;
}

export interface Resolved {
  course: MathTypeCourse;
  unit?: MathTypeUnit;
  type?: MathTypeItem;
}

// 과정·단원·유형 코드 무엇이든 → 해당 위치
export function resolveCode(data: MathTypesData | null, code: string | null | undefined): Resolved | null {
  if (!data || !code) return null;
  for (const course of data.courses) {
    if (code === course.code) return { course };
    if (!code.startsWith(course.code + "-")) continue;
    for (const unit of course.units) {
      if (code === unit.code) return { course, unit };
      if (!code.startsWith(unit.code + "-")) continue;
      const type = unit.types.find((t) => t.code === code);
      if (type) return { course, unit, type };
    }
  }
  return null;
}

export function typeLabel(data: MathTypesData | null, code: string | null | undefined): string {
  const r = resolveCode(data, code);
  if (!r) return "";
  return [r.course.name, r.unit && `${r.unit.no}. ${r.unit.name}`, r.type?.name].filter(Boolean).join(" · ");
}

// 과정 → 단원 → 유형 차례로 고르기.
// mode="pick": 유형까지 골라야 값이 생김(문제에 달 때). mode="filter": 과정·단원까지만 골라도 그 코드가 값(목록 거르기).
export default function MathTypePicker({
  value,
  onChange,
  mode = "pick",
  gradeHint,
  compact = false,
}: {
  value: string;
  onChange: (code: string) => void;
  mode?: "pick" | "filter";
  gradeHint?: string; // 과정을 아직 안 골랐을 때 이 학년 과정을 먼저 펼친다
  compact?: boolean;
}) {
  const data = useMathTypes();
  const resolved = resolveCode(data, value);
  const [courseCode, setCourseCode] = useState("");
  const [unitCode, setUnitCode] = useState("");

  // 값이 바뀌면(다른 문제 열기 등) 고르는 칸도 맞춰 준다
  useEffect(() => {
    if (resolved) {
      setCourseCode(resolved.course.code);
      setUnitCode(resolved.unit?.code ?? "");
    } else if (!value) {
      setUnitCode("");
      if (mode === "filter") setCourseCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, data]);

  // 학년 힌트로 첫 과정 미리 고르기(문제 고치기에서 유형이 아직 없을 때)
  useEffect(() => {
    if (!data || value || courseCode || !gradeHint || mode !== "pick") return;
    const c = data.courses.find((c) => c.grade === gradeHint);
    if (c) setCourseCode(c.code);
  }, [data, value, courseCode, gradeHint, mode]);

  const course = data?.courses.find((c) => c.code === courseCode);
  const unit = course?.units.find((u) => u.code === unitCode);
  const sel = `border border-gray-300 rounded-lg ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"} min-w-0`;

  if (!data) return <span className="text-xs text-gray-400">유형코드표 불러오는 중...</span>;

  const levels = [...new Set(data.courses.map((c) => c.level))];
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "w-full"}`}>
      <select
        value={courseCode}
        onChange={(e) => {
          setCourseCode(e.target.value);
          setUnitCode("");
          if (mode === "filter") onChange(e.target.value);
          else if (value) onChange("");
        }}
        className={sel}
        aria-label="과정"
      >
        <option value="">{mode === "filter" ? "유형 전체" : "과정 고르기"}</option>
        {mode === "filter" && <option value="none">유형 미지정</option>}
        {levels.map((lv) => (
          <optgroup key={lv} label={lv}>
            {data.courses
              .filter((c) => c.level === lv)
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {course && (
        <select
          value={unitCode}
          onChange={(e) => {
            setUnitCode(e.target.value);
            if (mode === "filter") onChange(e.target.value || course.code);
            else if (value) onChange("");
          }}
          className={sel}
          aria-label="단원"
        >
          <option value="">{mode === "filter" ? "단원 전체" : "단원 고르기"}</option>
          {course.units.map((u) => (
            <option key={u.code} value={u.code}>
              {u.no}. {u.name}
            </option>
          ))}
        </select>
      )}
      {unit && (
        <select
          value={resolved?.type ? value : ""}
          onChange={(e) => onChange(e.target.value || (mode === "filter" ? unit.code : ""))}
          className={`${sel} ${compact ? "max-w-[16rem]" : "flex-1"}`}
          aria-label="유형"
        >
          <option value="">{mode === "filter" ? "유형 전체" : "유형 고르기"}</option>
          {[...new Set(unit.types.map((t) => t.area))].map((area) => (
            <optgroup key={area} label={area}>
              {unit.types
                .filter((t) => t.area === area)
                .map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.no}. {t.name}
                    {t.optional ? " *" : ""}
                    {data.counts[t.code] ? ` (${data.counts[t.code]})` : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
