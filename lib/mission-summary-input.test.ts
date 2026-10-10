import { describe, expect, it } from "vitest";
import missionFixture from "./mock/mission-M014.json";
import { buildMissionSummaryInput } from "./mission-summary-input";
import type { MissionDetail } from "./types";

const mission = missionFixture as MissionDetail;

describe("buildMissionSummaryInput", () => {
  it("builds model input from mission facts and recorded evidence", () => {
    const input = buildMissionSummaryInput(mission);
    const failedActions = mission.actions.filter((action) => action.status === "FAILED");

    expect(input).toMatch(/^summarize: Mission M014 \(/);
    expect(input).toContain(`It had ${mission.actions.length} actions, of which ${failedActions.length} failed.`);
    expect(input).toContain(`${mission.problems.length} problems were recorded`);
    expect(input).not.toContain("undefined");
  });

  it("handles missions without problems, readings, or battery values", () => {
    const emptyMission = {
      ...mission,
      actions: [],
      problems: [],
      readings: [],
      start_battery_pct: null,
      end_battery_pct: null,
    };

    const input = buildMissionSummaryInput(emptyMission);

    expect(input).toContain("It had 0 actions, of which 0 failed.");
    expect(input).toContain("0 problems were recorded; 0 require operator review.");
    expect(input).toContain("0 readings were marked questionable.");
    expect(input).not.toContain("Battery:");
  });
});