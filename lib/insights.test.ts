import { describe, expect, it } from "vitest";
import insights from "./mock/insights.json";
import missions from "./mock/missions.json";
import {
  batteryBars,
  batterySoWhat,
  bucketLabel,
  causeBars,
  causesSoWhat,
  compareSoWhat,
  failShare,
  hero,
  heroLead,
  heatmapSoWhat,
  configTypeRows,
  locationRankings,
  reliabilitySoWhat,
  typeBars,
} from "./insights";
import type { Insights, MissionSummary } from "./types";

const i = insights as Insights;
const m = missions as MissionSummary[];

// Expected copy is the Figma Insights frame (8:326), which was written from the same kit data.
describe("Insights derivations", () => {
  it("builds the hero from the mission list", () => {
    const h = hero(i, m);
    expect(h).toMatchObject({ runs: 27, steps: 270, completed: 26, hidden: 14, hiddenRuns: 13, serious: 15, awaiting: 15, dateRange: "01 to 10 Sep 2026" });
    expect(heroLead(h)).toBe(
      "26 of 27 missions finished as completed, but 14 high or critical findings were recorded in 13 of those runs. 15 of 15 serious findings across all missions have no saved operator decision yet. Compare locations, battery levels and inspection types below.",
    );
    // Saving decisions changes the review count, never the recorded totals.
    const reviewed = hero(i, m.map((x) => ({ ...x, awaiting_review: 0 })));
    expect(reviewed).toMatchObject({ hidden: 14, serious: 15, awaiting: 0 });
    expect(heroLead(reviewed)).toContain("Every serious finding has a saved operator decision, which records a choice, not a confirmed fix.");
  });

  it("writes every So what sentence when Backend sends none", () => {
    expect(compareSoWhat(i)).toBe(
      "V2 recorded higher step success: 91% (82 of 90) versus 77% (139 of 180) on V1. V2 was also higher within 5 of 5 inspection types. This is an observed association: the runs differ in route, timing and battery, so it does not show the configuration caused the difference.",
    );
    expect(heatmapSoWhat(i)).toBe(
      "Pipe Gallery (WP05) recorded the most findings: 8 across 43 steps. Turbine Hall South (WP09) has the lowest step success: 14 of 22 ok (64%). Counts and failure rates rank stops differently, and neither weighs severity.",
    );
    expect(batterySoWhat(i)).toBe(
      "Below 20% battery, 3 of 11 steps succeeded (27%), versus 218 of 259 (84%) at 20% or above. Only 11 steps ran that low, so the rate is uncertain and can reflect other factors such as position in the mission or configuration. Docking before 20% is a suggested heuristic, not a measured threshold.",
    );
    // No sentence claims causality, an optimal threshold, or an order to walk stops in.
    for (const s of [compareSoWhat(i), heatmapSoWhat(i), batterySoWhat(i)]) {
      expect(s).not.toMatch(/walk it first|hotspot|optimal|plan to dock|because of V2/i);
    }
    expect(reliabilitySoWhat(i)).toBe(
      "Sound checks and gauge readings failed most often. Verify questionable readings before diagnosing equipment.",
    );
    expect(causesSoWhat(i)).toBe(
      "Unreliable readings and sensor timeouts account for 26 of 49 failed steps. Verify readings before diagnosing equipment.",
    );
  });

  it("prefers Backend's soWhat when present", () => {
    expect(compareSoWhat({ ...i, soWhat: { compare: "From the API." } })).toBe("From the API.");
  });

  it("labels and colours the battery buckets", () => {
    expect(batteryBars(i).map((b) => [b.label, b.pct, b.belowDock])).toEqual([
      ["<20%", 27, true],
      ["20–40", 72, false],
      ["40–60", 86, false],
      ["60–80", 90, false],
      ["80%+", 87, false],
    ]);
    expect(bucketLabel(80, 100)).toBe("80%+");
  });

  it("sorts inspection types best first and flags weak ones", () => {
    expect(typeBars(i).map((t) => [t.label, t.pct, t.weak])).toEqual([
      ["Visual check", 91, false],
      ["Heat check", 86, false],
      ["Walk to stop", 82, false],
      ["Gauge reading", 74, true],
      ["Sound check", 70, true],
    ]);
  });

  it("keeps five causes and folds the rest into Other", () => {
    const bars = causeBars(i);
    expect(bars.map((b) => b.count)).toEqual([14, 12, 7, 6, 4, 6]);
    expect(bars[5].label).toBe("Other (noise, obstacle, blocked path)");
    expect(bars.filter((b) => b.dataQuality).map((b) => b.key)).toEqual(["READING_UNRELIABLE", "SENSOR_TIMEOUT"]);
  });

  it("ranks stops by findings and by failure rate separately, with denominators", () => {
    expect(locationRankings(i)).toEqual({
      byFindings: [
        { location_id: "WP05", location_name: "Pipe Gallery", problems: 8, steps: 43 },
        { location_id: "WP09", location_name: "Turbine Hall South", problems: 6, steps: 22 },
        { location_id: "WP02", location_name: "Electrical Room", problems: 3, steps: 13 },
      ],
      byFailure: [
        { location_id: "WP09", location_name: "Turbine Hall South", stat: { total: 22, succeeded: 14, pct: 63.6 }, pct: 64 },
        { location_id: "WP15", location_name: "Inspection Dock", stat: { total: 16, succeeded: 11, pct: 68.8 }, pct: 69 },
        { location_id: "WP02", location_name: "Electrical Room", stat: { total: 13, succeeded: 9, pct: 69.2 }, pct: 69 },
      ],
    });
  });

  it("compares V1 and V2 within each inspection type and flags small or empty groups", () => {
    const rows = configTypeRows(i);
    expect(rows.map((r) => [r.action_type, `${r.V1.succeeded}/${r.V1.total}`, `${r.V2.succeeded}/${r.V2.total}`, r.diff, r.small])).toEqual([
      ["NAVIGATION", "36/46", "23/26", 10.2, false],
      ["VISUAL_INSPECTION", "44/50", "18/18", 12, true],
      ["THERMAL_INSPECTION", "24/31", "18/18", 22.6, true],
      ["ACOUSTIC_INSPECTION", "19/28", "11/15", 5.4, true],
      ["GAUGE_READING", "16/25", "12/13", 28.3, true],
    ]);
    // Group totals add back up to the overall comparison.
    expect(rows.reduce((n, r) => n + r.V1.total, 0)).toBe(i.compare.V1.actions.total);
    expect(rows.reduce((n, r) => n + r.V2.total, 0)).toBe(i.compare.V2.actions.total);
    const empty = configTypeRows({ ...i, byConfigType: [{ action_type: "GAUGE_READING", V1: { total: 3, succeeded: 2, pct: 66.7 }, V2: { total: 0, succeeded: 0, pct: 0 } }] });
    expect(empty[0]).toMatchObject({ diff: null, small: true });
    expect(configTypeRows({ ...i, byConfigType: undefined })).toEqual([]);
  });

  it("phrases failure share", () => {
    expect(failShare(74)).toBe("1 in 4 steps fail there");
    expect(failShare(100)).toBe("no steps fail there");
  });
});
