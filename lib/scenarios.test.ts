import { describe, expect, it } from "vitest";
import mission from "@/lib/mock/mission-M014.json";
import { deriveLive, msOf, timelineFromMission } from "@/lib/replay";
import { dockWalk, fromStop, scenarioFromParams, scenarioState, withScenario } from "@/lib/scenarios";
import type { MissionDetail } from "@/lib/types";

const m = mission as unknown as MissionDetail;
const plan = [...m.actions].sort((a, b) => a.sequence - b.sequence);
const all = new Set(plan.map((a) => a.action_id));

describe("what-if scenarios on M014", () => {
  it("shows only component-life alerts with no scenario on", () => {
    const s = scenarioState("M014", { heatC: 0, obstacle: false }, all, null, true);
    expect(s.alerts.map((a) => a.title)).toEqual(["PANEL-215: about 14 months of life left"]);
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

  it("reads ?heat and ?obstacle", () => {
    expect(scenarioFromParams("16", "1")).toEqual({ heatC: 16, obstacle: true });
    expect(scenarioFromParams("99", undefined)).toEqual({ heatC: 30, obstacle: false });
    expect(scenarioFromParams(undefined, "0")).toEqual({ heatC: 0, obstacle: false });
  });
});
