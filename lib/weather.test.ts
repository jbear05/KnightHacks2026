import { describe, expect, it } from "vitest";
import mission from "@/lib/mock/mission-M014.json";
import { deriveLive, msOf, timelineFromMission } from "@/lib/replay";
import { DEMO_PRESETS, demoForecast, outdoorFromParams, outdoorOf, withForecast } from "@/lib/weather";
import type { MissionDetail } from "@/lib/types";

const m = mission as unknown as MissionDetail;
const before = deriveLive(m, [], 0);
const day = (id: string) => outdoorOf("Orlando, FL", "demo", demoForecast(DEMO_PRESETS[id].weather, "2026-09-06"));

describe("outdoor weather check", () => {
  it("reads the demo days with map-sim's limits", () => {
    expect(day("sunny").verdict.safe).toBe(true);
    expect(day("drizzle").verdict.safe).toBe(true);
    expect(day("storm").verdict.reasons[0]).toMatch(/thunderstorms/);
    expect(day("snow").verdict.reasons[0]).toMatch(/snow or ice/);
    expect(day("arctic").verdict.reasons[0]).toMatch(/below SPOT's -20°C limit/);
    expect(day("scorching").verdict.reasons[0]).toMatch(/above SPOT's 45°C limit/);
    expect(day("windy").verdict.reasons[0]).toMatch(/gusts up to 75 km\/h/);
  });

  it("keeps an edited low above the high in order", () => {
    const f = demoForecast({ weatherCode: 0, minC: 10, maxC: -5, rainMm: -3, gustKmh: 10 }, "2026-09-06");
    expect([f.minC, f.maxC, f.rainMm]).toEqual([-5, 10, 0]);
  });

  it("puts a not-safe day on top of the queue, tagged as a what-if for demo weather", () => {
    const live = withForecast(before, day("storm"), "02:00:00");
    expect(live.queue[0]).toMatchObject({ kind: "sim", level: "critical", tag: "what-if", title: "Weather: not safe to go scan and scout" });
    expect(live.queue[0].kind === "sim" && live.queue[0].detail).toMatch(/demo weather/);
    expect(live.feed.at(-1)).toMatchObject({ glyph: "sim", detail: "· what-if" });
  });

  it("a safe real forecast is one feed row, no queue item", () => {
    const o = outdoorOf("Orlando, FL", "live", demoForecast(DEMO_PRESETS.sunny.weather, "2026-10-11"));
    const live = withForecast(deriveLive(m, timelineFromMission(m).slice(0, 1), msOf("2026-09-06T02:00:00")), o, "02:00:00");
    expect(live.queue.filter((q) => q.kind === "sim")).toHaveLength(0);
    expect(live.feed.at(-1)).toMatchObject({ glyph: "weather", text: "Weather: safe to go scan and scout", detail: "· forecast" });
  });

  it("reads ?outdoor, ?place and ?wx", () => {
    expect(outdoorFromParams()).toEqual({ on: false, place: "Orlando, FL", source: "live", preset: "storm" });
    expect(outdoorFromParams("1", "Chicago, IL")).toMatchObject({ on: true, place: "Chicago, IL", source: "live" });
    expect(outdoorFromParams(undefined, "Nowhere", "snow")).toEqual({ on: true, place: "Orlando, FL", source: "demo", preset: "snow" });
    expect(outdoorFromParams("1", undefined, "nope")).toMatchObject({ source: "live", preset: "storm" });
  });
});
