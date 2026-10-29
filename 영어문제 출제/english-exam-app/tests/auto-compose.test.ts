import { describe, expect, it } from "vitest";
import { pickFromBank, SUNEUNG_PRESETS } from "@/lib/auto-compose";
import { canGenerateWithAi, EXAM_TYPE_MAP } from "@/lib/question-types";
import { getSystemPrompt } from "@/lib/prompts";

const q = (id: string, extra: Record<string, unknown> = {}) => ({ id, questionType: "32_blank_sent", ...extra });

describe("은행에서 고르기", () => {
  const opts = { grade: "고1", allowNoGrade: true, exclude: new Set<string>() };

  it("학년 맞는 문제 → 안 쓴 문제 → 검수 통과 순", () => {
    const bank = [
      q("noGrade"),
      q("usedG1", { passageRef: { grade: "고1" }, examItems: [{}], verifyStatus: "ok" }),
      q("g1", { passageRef: { grade: "고1" } }),
      q("g1ok", { passageRef: { grade: "고1" }, verifyStatus: "ok" }),
    ];
    expect(pickFromBank(bank, "32_blank_sent", 4, opts).map((x) => x.id)).toEqual(["g1ok", "g1", "usedG1", "noGrade"]);
  });

  it("검수 '문제 있음', 다른 학년, 이미 고른 문제, 다른 유형은 빼고", () => {
    const bank = [
      q("err", { passageRef: { grade: "고1" }, verifyStatus: "error" }),
      q("g2", { passageRef: { grade: "고2" } }),
      q("taken"),
      { id: "other", questionType: "36_order" },
      q("ok"),
    ];
    const got = pickFromBank(bank, "32_blank_sent", 5, { ...opts, exclude: new Set(["taken"]) });
    expect(got.map((x) => x.id)).toEqual(["ok"]);
  });

  it("학년 없는 문제를 허용하지 않으면 학년 맞는 것만", () => {
    const bank = [q("noGrade"), q("g1", { passageRef: { grade: "고1" } })];
    expect(pickFromBank(bank, "32_blank_sent", 5, { ...opts, allowNoGrade: false }).map((x) => x.id)).toEqual(["g1"]);
  });
});

describe("AI 출제 가능 여부가 실제 지시문과 맞는다", () => {
  for (const ex of ["suneung", "naesin", "grammar"] as const) {
    for (const t of EXAM_TYPE_MAP[ex].types) {
      it(`${ex}/${t.code}`, () => {
        expect(canGenerateWithAi(ex, t.code)).toBe(getSystemPrompt(ex, t.code, "medium") !== null);
      });
    }
  }
});

describe("원클릭 구성", () => {
  it("수능형 독해는 18~40번 23문항, 번호 순서", () => {
    const p = SUNEUNG_PRESETS.find((x) => x.key === "reading-all")!;
    expect(p.types).toHaveLength(23);
    expect(p.types[0].code).toBe("18_purpose");
    expect(p.types[22].code).toBe("40_summary");
  });

  it("모든 프리셋 유형이 실제 수능 유형", () => {
    const codes = new Set(EXAM_TYPE_MAP.suneung.types.map((t) => t.code));
    for (const p of SUNEUNG_PRESETS) for (const t of p.types) expect(codes.has(t.code)).toBe(true);
  });
});
