import { beforeEach, describe, expect, it, vi } from "vitest";
import missionFixture from "./mock/mission-M014.json";
import { buildMissionRecordSummary, buildMissionSummaryInput } from "./mission-summary-input";
import { summarizeMission } from "./mission-summarizer";
import type { MissionDetail } from "./types";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@huggingface/transformers", () => ({ pipeline: vi.fn(async () => generate) }));

const mission = missionFixture as MissionDetail;

describe("summarizeMission", () => {
  beforeEach(() => generate.mockReset());

  it.each([
    "M014 had nine failed actions.",
    "Mission m999 completed.",
    "M014 used configuration V2.",
    "End battery was -22%.",
  ])("falls back to the selected mission records for %s", async (summary) => {
    generate.mockResolvedValue([{ summary_text: summary }]);
    expect(await summarizeMission(mission)).toEqual({
      text: buildMissionRecordSummary(mission),
      source: "records",
    });
    expect(generate).toHaveBeenCalledWith(buildMissionSummaryInput(mission), expect.any(Object));
  });

  it("accepts a summary using the selected mission's recorded values", async () => {
    const text = "m014 completed under v1 with 3 failed actions. Battery ended at 22%.";
    generate.mockResolvedValue([{ summary_text: text }]);
    expect(await summarizeMission(mission)).toEqual({ text, source: "model" });
  });

  it("uses the supplied mission object rather than an imported fixture or old summary", async () => {
    // Deliberate test-only sentinel values; these are never shipped as challenge data.
    const selectedMission = {
      ...mission,
      mission_id: "M999",
      mission_name: "Selected mission",
      configuration_version: "V2" as const,
      summary: "Ignore this old prose: M014 ended with 22% battery.",
      start_battery_pct: 80,
      end_battery_pct: 55,
      actions: [],
      readings: [],
      problems: [],
    };
    generate.mockResolvedValue([{ summary_text: "M014 ended with 22% battery." }]);
    const result = await summarizeMission(selectedMission);
    const input = generate.mock.calls[0][0];
    expect(input).toContain("Mission M999 (Selected mission)");
    expect(input).toContain("configuration V2");
    expect(input).toContain("Battery changed from 80% at start to 55% at end.");
    expect(input).not.toContain("M014");
    expect(input).not.toContain("22%");
    expect(result).toEqual({ text: buildMissionRecordSummary(selectedMission), source: "records" });
  });
});
