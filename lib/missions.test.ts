import { describe, expect, it } from "vitest";
import missions from "./mock/missions.json";
import { completedWithIssues, describeFilters, filterMissions, NO_FILTERS } from "./missions";
import type { MissionSummary } from "./types";

const all = missions as MissionSummary[];

describe("mission index filters", () => {
  it("lists all 27 missions with no filters, newest first", () => {
    const out = filterMissions(all, NO_FILTERS);
    expect(out).toHaveLength(27);
    expect(out[0].mission_id).toBe("M027");
    expect(out.at(-1)?.mission_id).toBe("M001");
  });

  it("combines search, configuration, status and issue filters", () => {
    expect(filterMissions(all, { ...NO_FILTERS, config: "V2" })).toHaveLength(9);
    expect(filterMissions(all, { ...NO_FILTERS, status: "FAILED" }).map((m) => m.mission_id)).toEqual(["M017"]);
    expect(filterMissions(all, { ...NO_FILTERS, q: "m01" })).toHaveLength(10);
    const v1Serious = filterMissions(all, { ...NO_FILTERS, config: "V1", show: "serious" });
    expect(v1Serious.every((m) => m.configuration_version === "V1" && m.serious_problems > 0)).toBe(true);
    expect(filterMissions(all, { ...NO_FILTERS, status: "FAILED", show: "clean" })).toEqual([]);
    // Fixtures carry no decisions, so every mission with serious findings is awaiting review.
    expect(filterMissions(all, { ...NO_FILTERS, show: "awaiting" })).toEqual(filterMissions(all, { ...NO_FILTERS, show: "serious" }));
    const reviewed = all.map((m) => (m.mission_id === "M014" ? { ...m, awaiting_review: 0 } : m));
    expect(filterMissions(reviewed, { ...NO_FILTERS, show: "awaiting" }).map((m) => m.mission_id)).not.toContain("M014");
  });

  it("matches the dataset: 21 of 26 completed missions had failed steps", () => {
    const completed = all.filter((m) => m.mission_status === "COMPLETED");
    expect(completed).toHaveLength(26);
    expect(completed.filter((m) => m.failed_actions > 0)).toHaveLength(21);
    expect(all.filter(completedWithIssues).length).toBeGreaterThanOrEqual(21);
  });

  it("describes active filters for the empty message", () => {
    expect(describeFilters({ ...NO_FILTERS, config: "V2", status: "FAILED", q: " x " })).toBe("V2 · failed · search “x”");
  });
});
