import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/generate-core", () => ({ generateVerifiedQuestion: vi.fn() }));

import { isStalled, isValidJobKey, jobKey, STALE_MS, summarizeItems } from "@/lib/gen-jobs";

describe("백그라운드 생성 작업", () => {
  it("작업 열쇠는 그 작업에만 맞는다", () => {
    expect(isValidJobKey("job1", jobKey("job1"))).toBe(true);
    expect(isValidJobKey("job2", jobKey("job1"))).toBe(false);
    expect(isValidJobKey("job1", "wrong")).toBe(false);
    expect(isValidJobKey("job1", null)).toBe(false);
  });

  it("진행 중인데 오래 소식이 없을 때만 멈춘 것으로 본다", () => {
    const old = new Date(Date.now() - STALE_MS - 1000);
    expect(isStalled({ status: "running", heartbeatAt: old })).toBe(true);
    expect(isStalled({ status: "running", heartbeatAt: new Date() })).toBe(false);
    expect(isStalled({ status: "done", heartbeatAt: old })).toBe(false);
  });

  it("상태별 개수", () => {
    const s = summarizeItems([{ status: "done" }, { status: "done" }, { status: "failed" }, { status: "pending" }, { status: "cancelled" }]);
    expect(s).toEqual({ total: 5, done: 2, failed: 1, running: 0, pending: 1 });
  });
});
