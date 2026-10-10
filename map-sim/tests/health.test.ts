/**
 * Tests for component health (from the data) and remaining life (simulated).
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  componentHealth, componentsAt, remainingWithHeat, lifeAlert, formatLife, readingPenalty, LIFE,
} from "../src/sim/health.ts";
import type { MissionData } from "../src/sim/scenario.ts";

const data: MissionData = JSON.parse(readFileSync(new URL("../data/missions.json", import.meta.url), "utf8"));
const health = componentHealth(data);

describe("health score (from the data)", () => {
  test("every component gets a score 5..100, and the reasons add up to the points lost", () => {
    assert.ok(health.size >= 15, `${health.size} components`);
    for (const h of health.values()) {
      assert.ok(h.score >= 5 && h.score <= 100, h.asset_id);
      const lost = h.reasons.reduce((s, r) => s + r.points, 0);
      if (h.score > 5) assert.equal(100 - lost, h.score, `${h.asset_id}: reasons don't explain the score`);
      assert.deepEqual(h.reasons.map(r => r.points), [...h.reasons].map(r => r.points).sort((a, b) => b - a), "biggest reason first");
    }
  });

  test("components with nothing wrong in the data score 100 and have no reasons", () => {
    const clean = [...health.values()].filter(h => !h.failed && !h.questionable && h.score === 100);
    assert.ok(clean.length >= 1);
    for (const h of clean) assert.deepEqual(h.reasons, []);
  });

  test("HX-208 (Cooling Loop) is the weakest: failed inspections and readings near the limits", () => {
    const worst = [...health.values()].sort((a, b) => a.score - b.score)[0];
    assert.equal(worst.asset_id, "HX-208");
    assert.equal(worst.stops[0], "WP03");
    assert.ok(worst.failed >= 4);
  });

  test("robot telemetry (localization confidence) never counts against a component", () => {
    assert.equal(readingPenalty({ measurement_type: "LOCALIZATION_CONFIDENCE_PCT", value: 10 }), null);
  });

  test("every component shows up on exactly one stop card", () => {
    const stops = ["WP01","WP02","WP03","WP04","WP05","WP06","WP07","WP08","WP09","WP10","WP11","WP12","WP13","WP14","WP15"];
    const shown = stops.flatMap(s => componentsAt(health, s).map(h => h.asset_id)).sort();
    assert.deepEqual(shown, [...health.keys()].sort());
  });

  test("stop cards list the weakest component first", () => {
    const at = componentsAt(health, "WP03");
    assert.equal(at[0].asset_id, "HX-208");
    assert.deepEqual(at.map(h => h.score), [...at].map(h => h.score).sort((a, b) => a - b));
  });
});

describe("remaining life (simulated)", () => {
  test("healthier means longer, for the same kind of component", () => {
    const hx = [...health.values()].filter(h => h.asset_id.startsWith("HX-")).sort((a, b) => a.score - b.score);
    for (let i = 1; i < hx.length; i++) assert.ok(hx[i].remainingMonths >= hx[i - 1].remainingMonths, hx[i].asset_id);
  });

  test("a perfect component has half its design life left", () => {
    const h = [...health.values()].find(h => h.score === 100)!;
    assert.equal(h.remainingMonths, h.designYears * 12 * (1 - LIFE.usedFraction));
  });

  test("10 degree rule: +10 C halves the remaining life, +20 C quarters it", () => {
    const h = { remainingMonths: 40 };
    assert.equal(remainingWithHeat(h, 0), 40);
    assert.equal(remainingWithHeat(h, 10), 20);
    assert.equal(remainingWithHeat(h, 20), 10);
  });

  test("alerts: HX-208 warns normally and goes critical in a heat wave; a healthy component never alerts", () => {
    const hx = health.get("HX-208")!;
    const normal = lifeAlert(hx, "Cooling Loop", "WP03", null)!;
    assert.equal(normal.level, "warning");
    assert.equal(normal.simulated, true);
    const hot = lifeAlert(hx, "Cooling Loop", "WP03", null, 10)!;
    assert.equal(hot.level, "critical");
    assert.match(hot.detail, /with the heat wave/);
    const fine = [...health.values()].find(h => h.score === 100)!;
    assert.equal(lifeAlert(fine, "x", "WP01", null), null);
  });

  test("formatLife reads naturally", () => {
    assert.equal(formatLife(0.4), "less than a month");
    assert.equal(formatLife(1), "1 month");
    assert.equal(formatLife(8.4), "8 months");
    assert.equal(formatLife(42), "3.5 years");
  });
});
