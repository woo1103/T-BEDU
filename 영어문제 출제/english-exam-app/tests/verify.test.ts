import { beforeEach, describe, expect, it, vi } from "vitest";

// 실제 AI 호출 대신 가짜 풀이 결과. vi.fn 대신 직접 만든 스텁(이 Vitest 버전에서 vi.fn이 거부된 Promise를 테스트 실패로 잡는 문제 회피)
const stub = vi.hoisted(() => ({
  impl: (async () => ({ answerIndex: 0, valid: "one", reason: "" })) as (input: { choices: string[] }) => Promise<unknown>,
  calls: [] as { choices: string[] }[],
}));
vi.mock("@/lib/claude", () => ({
  solveQuestion: (input: { choices: string[] }) => {
    stub.calls.push(input);
    return stub.impl(input);
  },
}));

import { isVerifiedSignature, judgeSolve, signVerified, verifyStoredQuestion } from "@/lib/verify";

const C = (correct: number) =>
  JSON.stringify(["a", "b", "c", "d", "e"].map((t, i) => ({ label: "①②③④⑤"[i], text: t, isCorrect: i === correct })));

describe("judgeSolve", () => {
  it("정답 하나·일치면 통과", () => {
    expect(judgeSolve(2, { answerIndex: 2, valid: "one", reason: "" }).ok).toBe(true);
  });
  it("불일치·정답없음·복수정답은 사유와 함께 실패", () => {
    expect(judgeSolve(1, { answerIndex: 3, valid: "one", reason: "r" }).note).toContain("④를 정답으로 판단(출제 정답 ②)");
    expect(judgeSolve(1, { answerIndex: -1, valid: "none", reason: "r" }).note).toContain("어느 선지도");
    expect(judgeSolve(1, { answerIndex: 1, valid: "multiple", reason: "r" }).note).toContain("2개 이상");
  });
});

describe("검수 통과 서명", () => {
  const q = { passage: "P", question: "Q", choices: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] };
  it("같은 내용이면 맞고, 라벨이 달라도 맞다", () => {
    const sig = signVerified(q);
    expect(isVerifiedSignature({ ...q, choices: q.choices.map((c, i) => ({ ...c, label: "①②"[i] })) }, sig)).toBe(true);
  });
  it("저장 전에 선지·정답·지문을 고치면 맞지 않는다", () => {
    const sig = signVerified(q);
    expect(isVerifiedSignature({ ...q, passage: "P2" }, sig)).toBe(false);
    expect(isVerifiedSignature({ ...q, choices: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: true }] }, sig)).toBe(false);
    expect(isVerifiedSignature(q, "nope")).toBe(false);
    expect(isVerifiedSignature(q, undefined)).toBe(false);
  });
});

describe("verifyStoredQuestion", () => {
  beforeEach(() => {
    stub.calls.length = 0;
  });

  it("정답 표시가 없으면 AI를 부르지 않고 의심", async () => {
    const r = await verifyStoredQuestion({ passage: "P", question: "Q", choices: C(-1) });
    expect(r).toEqual({ status: "suspect", note: "정답 표시 없음" });
    expect(stub.calls).toHaveLength(0);
  });
  it("검수자와 출제 정답이 같으면 통과", async () => {
    stub.impl = async () => ({ answerIndex: 2, valid: "one", reason: "" });
    expect((await verifyStoredQuestion({ passage: "P", question: "Q", choices: C(2) })).status).toBe("ok");
  });
  it("다르면 의심", async () => {
    stub.impl = async () => ({ answerIndex: 0, valid: "one", reason: "근거" });
    const r = await verifyStoredQuestion({ passage: "P", question: "Q", choices: C(2) });
    expect(r.status).toBe("suspect");
    expect(r.note).toContain("①를 정답으로 판단(출제 정답 ③)");
  });
  it("AI 호출이 실패하면 오류(나중에 다시 검수)", async () => {
    stub.impl = async () => {
      throw new Error("network down");
    };
    expect(await verifyStoredQuestion({ passage: "P", question: "Q", choices: C(2) })).toEqual({
      status: "error",
      note: "network down",
    });
  });
  it("마커형 선지는 ①→⑤로 맞춘 순서로 정답을 판단", async () => {
    // 저장 순서 ③,①,② … 정답은 ③ 마커
    const choices = JSON.stringify([
      { label: "③", text: "③", isCorrect: true },
      { label: "①", text: "①", isCorrect: false },
      { label: "②", text: "②", isCorrect: false },
      { label: "④", text: "④", isCorrect: false },
      { label: "⑤", text: "⑤", isCorrect: false },
    ]);
    stub.impl = async () => ({ answerIndex: 2, valid: "one", reason: "" });
    expect((await verifyStoredQuestion({ passage: "P", question: "Q", choices })).status).toBe("ok");
    expect(stub.calls[0].choices).toEqual(["①", "②", "③", "④", "⑤"]);
  });
});
