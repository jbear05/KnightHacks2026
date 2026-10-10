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
  nextWorst,
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
    expect(compareSoWhat(i)).toBe("V2 recorded higher success: 91% versus 77%. Compare similar routes before changing configuration.");
    expect(heatmapSoWhat(i)).toBe(
      "Pipe Gallery (WP05) is the hotspot: 8 problems and 1 in 4 steps fail there, so walk it first when a tech goes out.",
    );
    expect(nextWorst(i)).toBe(
      "Next worst: Turbine Hall South (WP09), 6 problems and 64% of steps ok. Inspection Dock (WP15), 69% of steps ok.",
    );
    expect(batterySoWhat(i)).toBe("Only 3 of 11 steps succeeded below 20% battery. Plan to dock before reaching 20%.");
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

  it("phrases failure share", () => {
    expect(failShare(74)).toBe("1 in 4 steps fail there");
    expect(failShare(100)).toBe("no steps fail there");
  });
});
