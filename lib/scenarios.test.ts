import { describe, expect, it } from "vitest";
import mission from "@/lib/mock/mission-M014.json";
import { deriveLive, msOf, playedCount, timelineFromMission } from "@/lib/replay";
import { coldAmbientC, dockWalk, healthSoFar, fromStop, scenarioFromParams, scenarioState, withScenario } from "@/lib/scenarios";
import type { MissionDetail } from "@/lib/types";

const m = mission as unknown as MissionDetail;
const plan = [...m.actions].sort((a, b) => a.sequence - b.sequence);
const all = new Set(plan.map((a) => a.action_id));

describe("what-if scenarios on M014", () => {
  it("shows only component-life alerts with no scenario on", () => {
    const s = scenarioState("M014", { heatC: 0, obstacle: false }, all, null, true);
    expect(s.alerts.map((a) => a.title)).toEqual(["PANEL-215: about 16 months of life left"]);
    expect(s.skipped.size).toBe(0);
    expect(s.airC).toBeNull();
  });

  it("raises heat alerts and skips the stop above SPOT's 45°C limit", () => {
    const s = scenarioState("M014", { heatC: 16, obstacle: false }, all, null, true);
    expect([...s.skipped]).toEqual(["A0138"]);
    expect(s.alerts.every((a) => a.simulated)).toBe(true);
    expect(s.alerts.some((a) => a.title === "Too hot for SPOT: stop skipped" && a.location_id === "WP09")).toBe(true);
    expect(s.alerts.some((a) => a.title === "Dock too hot to charge")).toBe(true);
  });

  it("raises the dock obstacle only once SPOT gets close, and walks around it", () => {
    const i = plan.findIndex((a) => a.location_id === "WP15");
    const walk = dockWalk(fromStop(plan, i, new Set()))!;
    expect(walk.rerouted).toBe(true);
    const before = new Set(plan.slice(0, i).map((a) => a.action_id));
    const cur = (progress: number) => ({ action_id: plan[i].action_id, location_id: "WP15", progress, inspecting: false });
    const title = "Obstacle in front of the Inspection Dock";
    expect(scenarioState("M014", { heatC: 0, obstacle: true }, before, cur(walk.seeAt - 0.05), false).alerts.some((a) => a.title === title)).toBe(false);
    expect(scenarioState("M014", { heatC: 0, obstacle: true }, before, cur(walk.seeAt + 0.01), false).alerts.some((a) => a.title === title)).toBe(true);
  });

  it("drops a skipped step from the tally and the feed, and adds the what-if rows", () => {
    const timeline = timelineFromMission(m);
    const end = msOf(m.end_time ?? plan[plan.length - 1].timestamp);
    const base = deriveLive(m, timeline, end);
    const live = withScenario(base, scenarioState("M014", { heatC: 16, obstacle: false }, all, null, true));
    expect(live.succeeded + live.failed).toBe(base.succeeded + base.failed - 1);
    expect(live.feed.some((r) => r.key.startsWith("A0138-"))).toBe(false);
    expect(live.feed.some((r) => r.glyph === "sim")).toBe(true);
    expect(live.queue[0]).toMatchObject({ kind: "sim", level: "critical" });
  });

  it("reads ?heat, ?cold and ?obstacle", () => {
    expect(scenarioFromParams("16", "1")).toEqual({ heatC: 16, coldC: 0, obstacle: true });
    expect(scenarioFromParams("99", undefined)).toEqual({ heatC: 30, coldC: 0, obstacle: false });
    expect(scenarioFromParams(undefined, "0")).toEqual({ heatC: 0, coldC: 0, obstacle: false });
    expect(scenarioFromParams(undefined, undefined, "55")).toEqual({ heatC: 0, coldC: 55, obstacle: false });
    expect(scenarioFromParams(undefined, undefined, "999").coldC).toBe(70);
    // heat and cold are one air temperature: heat wins
    expect(scenarioFromParams("16", undefined, "55")).toEqual({ heatC: 16, coldC: 0, obstacle: false });
  });
});

describe("component health so far", () => {
  it("counts earlier missions and this mission's played steps only", () => {
    expect(healthSoFar("M001", new Set()).size).toBe(0);
    const before = healthSoFar("M014", new Set());
    const after = healthSoFar("M014", all);
    const later = healthSoFar("M027", new Set());
    const n = (h: Map<string, { inspections: number }>) => [...h.values()].reduce((s, c) => s + c.inspections, 0);
    expect(n(before)).toBeLessThan(n(after));
    expect(n(after)).toBeLessThan(n(later));
  });
});

describe("cold snap on M014", () => {
  it("cools the air from half to full strength, corridors colder than machinery rooms", () => {
    expect(coldAmbientC({ zone: "ACCESS", floor: 1 }, 0, 40)).toBe(6);
    expect(coldAmbientC({ zone: "ACCESS", floor: 1 }, 1, 40)).toBe(-14);
    expect(coldAmbientC({ zone: "MECHANICAL", floor: 1 }, 1, 40)).toBe(-9);
  });

  it("skips stops below SPOT's -20°C limit and warns about the dock charger", () => {
    const s = scenarioState("M014", { heatC: 0, coldC: 55, obstacle: false }, all, null, true);
    expect(s.skipReason).toBe("cold");
    expect(s.skipped.size).toBeGreaterThan(0);
    expect(s.alerts.every((a) => a.simulated)).toBe(true);
    expect(s.alerts.some((a) => a.title === "Too cold for SPOT: stop skipped")).toBe(true);
    expect(s.alerts.some((a) => a.title === "Dock too cold to charge")).toBe(true);
    expect(s.alerts.some((a) => a.title.startsWith("Too hot"))).toBe(false);
  });

  it("a mild cold snap only warns the charger, nothing is skipped", () => {
    const s = scenarioState("M014", { heatC: 0, coldC: 30, obstacle: false }, all, null, true);
    expect(s.skipped.size).toBe(0);
    expect(s.alerts.some((a) => a.title === "Dock too cold to charge")).toBe(true);
  });

  it("ignores the cold snap while the heat wave is on", () => {
    const hot = scenarioState("M014", { heatC: 16, obstacle: false }, all, null, true);
    const both = scenarioState("M014", { heatC: 16, coldC: 55, obstacle: false }, all, null, true);
    expect(both.alerts).toEqual(hot.alerts);
    expect(both.skipReason).toBe("hot");
  });

  it("marks the current skipped step as too cold", () => {
    const base = deriveLive(m, timelineFromMission(m), msOf(m.end_time!));
    const s = scenarioState("M014", { heatC: 0, coldC: 70, obstacle: false }, all, null, true);
    const skippedId = [...s.skipped][0];
    const fake = { ...base, current: { action: plan.find((a) => a.action_id === skippedId)!, step: 1, phase: "walking" as const, fromLocationId: "WP01", arriveAt: 0, progress: 0.5 } };
    expect(withScenario(fake, s).current).toMatchObject({ phase: "skipping", skipReason: "cold" });
  });
});

describe("skipped-step consistency", () => {
  it("removes skipped inspections' findings from the map state, queue and feed without changing history", () => {
    const base = deriveLive(m, timelineFromMission(m), msOf(m.end_time!));
    const state = scenarioState("M014", { heatC: 30, obstacle: false }, all, null, true);
    expect(state.skipped.has("A0132")).toBe(true);
    expect(state.skipped.has("A0133")).toBe(true);
    const skippedProblems = base.problems.filter((p) => state.skipped.has(p.action_id));
    expect(skippedProblems.map((p) => p.anomaly_id).sort()).toEqual(["AN002", "AN035"]);
    const live = withScenario(base, state);
    expect(live.problems).toEqual(base.problems.filter((p) => !state.skipped.has(p.action_id)));
    expect(live.queue.some((q) => q.kind === "problem" && state.skipped.has(q.problem.action_id))).toBe(false);
    expect(live.queue.some((q) => q.kind === "failed" && state.skipped.has(q.action.action_id))).toBe(false);
    expect(live.feed.some((r) => skippedProblems.some((p) => r.key === `P${p.anomaly_id}`))).toBe(false);
    expect(base.problems).toHaveLength(2);
    expect(m.problems).toHaveLength(2);
  });

  it.each(["02:19:00", "02:20:30"])("holds at the previous stop during a skipped step at %s", (time) => {
    const timeline = timelineFromMission(m);
    const clock = msOf(`2026-09-06T${time}`);
    const base = deriveLive(m, timeline.slice(0, playedCount(timeline, clock)), clock);
    const cur = base.current!;
    const state = scenarioState("M014", { heatC: 16, obstacle: false }, new Set(base.results.map((r) => r.action.action_id)), { ...cur.action, progress: cur.progress, inspecting: cur.phase === "inspecting" }, false, time);
    expect(state.skipped.has("A0138")).toBe(true);
    expect(withScenario(base, state).current).toMatchObject({ phase: "skipping", fromLocationId: "WP01", progress: 0 });
    expect(base.current?.phase).not.toBe("skipping");
  });

  it("starts the next walk from the last visited stop and restores history when heat is off", () => {
    const timeline = timelineFromMission(m);
    const clock = msOf("2026-09-06T02:21:00");
    const base = deriveLive(m, timeline.slice(0, playedCount(timeline, clock)), clock);
    const cur = base.current!;
    const finished = new Set(base.results.map((r) => r.action.action_id));
    const current = { ...cur.action, progress: cur.progress, inspecting: cur.phase === "inspecting" };
    const heated = withScenario(base, scenarioState("M014", { heatC: 16, obstacle: false }, finished, current, false));
    expect(heated.current).toMatchObject({ phase: "walking", fromLocationId: "WP01", action: { action_id: "A0139" } });
    const normal = withScenario(base, scenarioState("M014", { heatC: 0, obstacle: false }, finished, current, false));
    expect(normal.current).toEqual(base.current);
    expect(normal.problems).toEqual(base.problems);
    expect(normal.results).toEqual(base.results);
  });
});
