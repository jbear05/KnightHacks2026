import { describe, expect, it } from "vitest";
import mission from "./mock/mission-M014.json";
import { deriveLive, msOf, playedCount, stepSentence, timelineFromMission } from "./replay";
import type { MissionDetail } from "./types";

const m = mission as MissionDetail;
const timeline = timelineFromMission(m);
const at = (ts: string) => {
  const clock = msOf(ts);
  return deriveLive(m, timeline.slice(0, playedCount(timeline, clock)), clock);
};

describe("timelineFromMission", () => {
  it("matches replay.ndjson for M014: 22 events plus one PROBLEM_FOUND per problem", () => {
    expect(timeline).toHaveLength(22 + m.problems.length);
    expect(timeline[0]).toMatchObject({ event_type: "MISSION_STARTED", timestamp: "2026-09-06T02:00:00", details: { battery_pct: 68 } });
    expect(timeline.at(-1)).toMatchObject({ event_type: "MISSION_COMPLETED", details: { status: "COMPLETED", end_battery_pct: 22 } });
  });

  it("puts each problem right after the result of the action that found it", () => {
    const i = timeline.findIndex((e) => e.event_type === "PROBLEM_FOUND" && e.details.problem.anomaly_id === "AN002");
    expect(timeline[i - 1]).toMatchObject({ event_type: "ACTION_FAILED", details: { action_id: "A0133" } });
  });
});

describe("deriveLive", () => {
  it("reproduces the Figma state while SPOT heads to step 6 (WP07)", () => {
    const s = at("2026-09-06T02:14:00");
    expect([s.succeeded, s.failed, s.toGo]).toEqual([2, 3, 5]);
    expect(s.current).toMatchObject({ step: 6, phase: "walking", fromLocationId: "WP13", action: { location_id: "WP07" } });
    // Two serious problems by priority, then the failed walk that no problem covers.
    expect(s.queue.map((q) => q.key)).toEqual(["AN002", "AN035", "A0134"]);
    expect(stepSentence(s.current!, 10)).toMatch(/^Step 6 of 10 · (walking to|arriving at) Control Room Corridor \(WP07\) for a gauge reading$/);
  });

  it("switches to inspecting duration_sec before the step's timestamp", () => {
    const due = msOf("2026-09-06T02:15:36");
    const dur = m.actions.find((a) => a.action_id === "A0136")!.duration_sec! * 1000;
    const clock = due - dur + 1000;
    const s = deriveLive(m, timeline.slice(0, playedCount(timeline, clock)), clock);
    expect(s.current?.phase).toBe("inspecting");
    expect(s.feed[0]).toMatchObject({ text: "Gauge reading started", detail: "· WP07" });
  });

  it("handles seeking back to the start and the end", () => {
    const first = at("2026-09-06T02:00:00");
    expect(first.current?.step).toBe(1);
    expect(first.battery).toBe(68);
    const last = at("2026-09-06T02:26:00");
    expect(last.ended).toBe(true);
    expect(last.current).toBeNull();
    expect(last.battery).toBe(22);
  });
});
