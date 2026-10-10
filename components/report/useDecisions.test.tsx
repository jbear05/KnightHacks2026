// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import mission from "@/lib/mock/mission-M014.json";
import type { Decision, Problem } from "@/lib/types";
import { useDecisions } from "./useDecisions";

// setDecision is replaced by a queue of promises the test settles in any order.
type Call = { problem: Problem; decision: Decision; resolve: () => void; reject: (e: Error) => void };
const calls: Call[] = [];
vi.mock("@/lib/api", () => ({
  USE_MOCK: false,
  setDecision: (problem: Problem, decision: Decision) =>
    new Promise<Problem>((resolve, reject) => {
      calls.push({ problem, decision, resolve: () => resolve({ ...problem, decision }), reject });
    }),
}));

const problems = mission.problems as Problem[];
const [hx217, panel212] = problems; // sorted by priority: HX-217 (12), PANEL-212 (9)

async function settle(fn: () => void) {
  await act(async () => {
    fn();
    await Promise.resolve();
  });
}

const decisionOf = (ps: Problem[], id: string) => ps.find((p) => p.anomaly_id === id)?.decision;

describe("useDecisions", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("keeps the newest choice when an older save answers last", async () => {
    const { result } = renderHook(() => useDecisions(problems));
    act(() => void result.current.decide(hx217, "dispatch"));
    act(() => void result.current.decide(hx217, "watch"));
    expect(decisionOf(result.current.problems, hx217.anomaly_id)).toBe("watch");

    await settle(() => calls[1].resolve()); // watch answers first
    await settle(() => calls[0].resolve()); // stale dispatch answers last
    expect(decisionOf(result.current.problems, hx217.anomaly_id)).toBe("watch");
    expect(result.current.pending.has(hx217.anomaly_id)).toBe(false);
    expect(result.current.message?.text).toContain("HX-217: watch recorded.");
    // A saved choice is a decision, not a resolution or a notification.
    expect(result.current.message?.text).toContain("does not notify a technician or mark the equipment fixed");
  });

  it("ignores a stale failure instead of rolling back the newer choice", async () => {
    const { result } = renderHook(() => useDecisions(problems));
    act(() => void result.current.decide(hx217, "dispatch"));
    act(() => void result.current.decide(hx217, "dismiss"));
    await settle(() => calls[1].resolve());
    await settle(() => calls[0].reject(new Error("timeout")));
    expect(decisionOf(result.current.problems, hx217.anomaly_id)).toBe("dismiss");
    expect(result.current.message?.error).toBe(false);
  });

  it("rolls a failed save back to the last confirmed decision", async () => {
    const { result } = renderHook(() => useDecisions(problems));
    act(() => void result.current.decide(hx217, "dispatch"));
    await settle(() => calls[0].resolve());
    act(() => void result.current.decide(hx217, "watch"));
    await settle(() => calls[1].reject(new Error("Server down")));
    expect(decisionOf(result.current.problems, hx217.anomaly_id)).toBe("dispatch");
    expect(result.current.message).toEqual({ text: "Couldn't save the decision for HX-217. Server down", error: true });
  });

  it("keeps each row locked until its own save finishes", async () => {
    const { result } = renderHook(() => useDecisions(problems));
    act(() => void result.current.decide(hx217, "dispatch"));
    act(() => void result.current.decide(panel212, "watch"));
    await settle(() => calls[1].resolve()); // PANEL-212 finishes first
    expect(result.current.pending.has(panel212.anomaly_id)).toBe(false);
    expect(result.current.pending.has(hx217.anomaly_id)).toBe(true);
    await settle(() => calls[0].resolve());
    expect(result.current.pending.size).toBe(0);
    expect(decisionOf(result.current.problems, hx217.anomaly_id)).toBe("dispatch");
    expect(decisionOf(result.current.problems, panel212.anomaly_id)).toBe("watch");
  });
});
