"use client";

import { useState, type ReactNode } from "react";

export interface TreeRow {
  id: string;
  grade?: string | null;
  subject?: string | null; // "english" | "math" | "etc"
  source?: string | null;
}

const GRADE_ORDER = ["중1", "중2", "중3", "고1", "고2", "고3"];
const SUBJECT_LABEL: Record<string, string> = {
  english: "영어",
  math: "수학",
  etc: "기타",
};

function sortGrades(a: string, b: string) {
  const ia = GRADE_ORDER.indexOf(a);
  const ib = GRADE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

// 학년 → 과목 → 출처(영어만) → 항목 트리. 기본 접힘, 클릭해서 펼침.
export default function SourceTree<T extends TreeRow>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (it: T) => ReactNode;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  // 그룹핑
  type L3 = Map<string, T[]>;
  type L2 = Map<string, L3>;
  const tree = new Map<string, L2>();
  for (const it of items) {
    const g = it.grade || "학년 미지정";
    const subj = it.subject || "english";
    const subjLabel = SUBJECT_LABEL[subj] || subj;
    const src =
      subj === "english" ? it.source || "출처 미지정" : "전체";
    if (!tree.has(g)) tree.set(g, new Map());
    const l2 = tree.get(g)!;
    if (!l2.has(subjLabel)) l2.set(subjLabel, new Map());
    const l3 = l2.get(subjLabel)!;
    if (!l3.has(src)) l3.set(src, []);
    l3.get(src)!.push(it);
  }

  const grades = [...tree.keys()].sort(sortGrades);
  if (grades.length === 0)
    return <div className="p-8 text-center text-gray-400">항목이 없습니다.</div>;

  function countL2(l2: L2) {
    let n = 0;
    for (const l3 of l2.values()) for (const arr of l3.values()) n += arr.length;
    return n;
  }
  function countL3(l3: L3) {
    let n = 0;
    for (const arr of l3.values()) n += arr.length;
    return n;
  }

  return (
    <div className="divide-y divide-gray-100">
      {grades.map((g) => {
        const l2 = tree.get(g)!;
        const gKey = `g:${g}`;
        const gOpen = open.has(gKey);
        return (
          <div key={gKey}>
            <button
              onClick={() => toggle(gKey)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-gray-400 text-xs w-4">{gOpen ? "▼" : "▶"}</span>
              <span className="font-semibold text-gray-800">{g}</span>
              <span className="text-xs text-gray-400 ml-auto">{countL2(l2)}개</span>
            </button>
            {gOpen &&
              [...l2.keys()].sort().map((subj) => {
                const l3 = l2.get(subj)!;
                const sKey = `${gKey}/s:${subj}`;
                const sOpen = open.has(sKey);
                return (
                  <div key={sKey} className="border-t border-gray-50">
                    <button
                      onClick={() => toggle(sKey)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-blue-50"
                      style={{ paddingLeft: 28 }}
                    >
                      <span className="text-gray-400 text-xs w-4">
                        {sOpen ? "▼" : "▶"}
                      </span>
                      <span className="font-medium text-blue-700">{subj}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {countL3(l3)}개
                      </span>
                    </button>
                    {sOpen &&
                      [...l3.keys()].sort().map((src) => {
                        const arr = l3.get(src)!;
                        const srcKey = `${sKey}/src:${src}`;
                        const srcOpen = open.has(srcKey);
                        return (
                          <div key={srcKey} className="border-t border-gray-50">
                            <button
                              onClick={() => toggle(srcKey)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-amber-50"
                              style={{ paddingLeft: 48 }}
                            >
                              <span className="text-gray-400 text-xs w-4">
                                {srcOpen ? "▼" : "▶"}
                              </span>
                              <span className="text-amber-700 text-sm">{src}</span>
                              <span className="text-xs text-gray-400 ml-auto">
                                {arr.length}개
                              </span>
                            </button>
                            {srcOpen && (
                              <ul className="py-1" style={{ paddingLeft: 56, paddingRight: 12 }}>
                                {arr.map((it) => (
                                  <li key={it.id} className="py-0.5">
                                    {renderItem(it)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
