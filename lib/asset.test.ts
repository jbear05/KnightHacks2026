import { describe, expect, it } from "vitest";
import assets from "./mock/assets.json";
import {
  axisFor,
  dayRange,
  factsOf,
  failedSteps,
  findingsLine,
  labelSide,
  laneRows,
  leadSentence,
  photoType,
  problemContext,
  rangeLabel,
  splitSeries,
  xFrac,
} from "./asset";
import type { AssetDetail } from "./types";

const panel = (assets as unknown as Record<string, AssetDetail>)["PANEL-212"];

describe("Asset Detail numbers for PANEL-212 (Figma frame 8:455)", () => {
  it("matches the facts strip", () => {
    expect(factsOf(panel)).toEqual({ readings: 9, questionable: 3, problems: 5, hidden: 2, lastVisit: "2026-09-10T02:02:18" });
  });

  it("writes the headline", () => {
    expect(findingsLine(panel)).toBe("5 findings in 10 days.");
    expect(leadSentence(panel)).toBe(
      "SPOT inspected this panel 10 times. Five findings were recorded, including two serious findings in completed missions.",
    );
  });

  it("charts pressure then visual score, and lists temperature and sound as one-offs", () => {
    const { charts, oneOffs } = splitSeries(panel.readings);
    expect(charts.map((c) => [c.type, c.readings.length])).toEqual([
      ["PRESSURE_PSI", 3],
      ["VISUAL_SCORE", 4],
    ]);
    expect(oneOffs.map((r) => r.measurement_type)).toEqual(["TEMPERATURE_C", "SOUND_DB"]);
  });

  it("uses the Figma axes and date range", () => {
    expect(axisFor([140.8, 86.4, 99]).ticks).toEqual([50, 100, 150]);
    expect(axisFor([83, 83, 74, 98]).ticks).toEqual([60, 80, 100]);
    const range = dayRange(panel)!;
    expect(range.days).toBe(10);
    expect(rangeLabel(range.from, range.to)).toBe("1 to 10 Sep 2026");
    // 5 Sep 02:29 sits at x = 389 on the 812px Figma plot that starts at 56.
    expect(56 + xFrac("2026-09-05T02:29:42", range) * 812).toBeCloseTo(389.2, 0);
  });

  it("places value labels and staggers close problem markers like the mock", () => {
    const visual = splitSeries(panel.readings).charts[1].readings;
    expect(visual.map((_, i) => labelSide(visual, i))).toEqual(["above", "above", "left", "above"]);
    const rows = laneRows(panel.problems);
    expect(["AN035", "AN003", "AN030", "AN026", "AN011"].map((id) => rows.get(id))).toEqual([0, 1, 0, 0, 1]);
  });

  it("explains each past problem", () => {
    expect(panel.problems.map((p) => problemContext(panel, p))).toEqual([
      "mission failed",
      "gauge step timed out",
      "visual score 74, check sensor",
      "logged away from its home stop",
      "logged away from its home stop",
    ]);
  });

  it("lists failed steps, separating no-reading failures, walk failures and away-from-home steps", () => {
    const rows = failedSteps(panel)!.map((f) => [f.action.action_id, f.action.location_id, f.walk, f.away, f.reading?.reading_id ?? null]);
    expect(rows).toEqual([
      ["A0089", "WP09", false, false, expect.any(String)],
      ["A0109", "WP08", false, true, expect.any(String)],
      ["A0132", "WP09", false, false, null], // M014 gauge step timed out with no reading
      ["A0160", "WP09", false, false, expect.any(String)],
      ["A0169", "WP09", true, false, null], // M017 walk lost communication: robot, not equipment
    ]);
    expect(failedSteps({ ...panel, actions: undefined })).toBeNull();
  });

  it("still works without the optional actions list", () => {
    const bare = { ...panel, actions: undefined };
    expect(leadSentence(bare)).toMatch(/^SPOT took 9 equipment readings on this panel\./);
    expect(photoType(bare)).toBe("VISUAL_INSPECTION");
    expect(photoType(panel)).toBe("GAUGE_READING");
  });
});
