/**
 * Tests for mission alerts and the what-if scenarios (heat wave, obstacle at the dock).
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NavGrid, pointAlong, polylineLength } from "../src/sim/astar.ts";
import {
  missionActions, missionProgress, ambientC, heatAlert, dockChargerAlert, actionAlerts,
  obstacleOnApproach, distToRect, dockObstacleAlert, LIMITS, HEAT,
} from "../src/sim/scenario.ts";
import type { MissionData } from "../src/sim/scenario.ts";
import type { MapData, Stop } from "../src/sim/types.ts";

const map: MapData = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
const data: MissionData = JSON.parse(readFileSync(new URL("../data/missions.json", import.meta.url), "utf8"));
const stop = Object.fromEntries(map.stops.map(s => [s.id, s])) as Record<string, Stop>;
const action = (id: string) => data.actions.find(a => a.action_id === id)!;

describe("mission data (data/missions.json)", () => {
  test("27 missions, every action at a known stop, sequences 1..n with no gaps", () => {
    const ids = [...new Set(data.actions.map(a => a.mission_id))];
    assert.equal(ids.length, 27);
    for (const id of ids) {
      const acts = missionActions(data, id);
      assert.deepEqual(acts.map(a => a.sequence), acts.map((_, i) => i + 1), id);
      for (const a of acts) assert.ok(stop[a.location_id], `${a.action_id} at unknown ${a.location_id}`);
    }
  });

  test("every reading belongs to an action of the same mission", () => {
    for (const r of data.readings) {
      const a = action(r.action_id);
      assert.ok(a, r.reading_id);
      assert.equal(a.mission_id, r.mission_id, r.reading_id);
    }
  });

  test("mission progress runs 0 -> 1 over the mission", () => {
    const acts = missionActions(data, "M001");
    assert.equal(missionProgress(acts, acts[0]), 0);
    assert.equal(missionProgress(acts, acts.at(-1)!), 1);
    const p = acts.map(a => missionProgress(acts, a));
    assert.deepEqual(p, [...p].sort((a, b) => a - b), "never goes backwards");
  });
});

describe("heat wave (simulated)", () => {
  test("no heat wave: no heat alerts at all", () => {
    for (const s of map.stops) {
      assert.equal(heatAlert(s, 1, 0), null);
      assert.equal(dockChargerAlert(s, 1, 0), null);
    }
  });

  test("air temperature climbs over the mission, and machinery rooms run hotter than corridors", () => {
    assert.ok(ambientC(stop.WP04, 1, 16) > ambientC(stop.WP04, 0, 16));
    assert.ok(ambientC(stop.WP04, 0.5, 16) > ambientC(stop.WP07, 0.5, 16)); // MECHANICAL vs ACCESS
    assert.equal(ambientC(stop.WP07, 0, 0), HEAT.baseC);
  });

  test("thresholds: above 45C SPOT skips the stop (critical), 40-45C is a warning", () => {
    // find intensities that put WP04 (MECHANICAL, floor 1) just either side of each limit, at the end of the mission
    const at = (c: number) => c - HEAT.baseC - HEAT.zoneC.MECHANICAL; // intensity for an air temp of c at progress 1
    assert.equal(heatAlert(stop.WP04, 1, at(39.9)), null);
    assert.equal(heatAlert(stop.WP04, 1, at(42))!.level, "warning");
    const hot = heatAlert(stop.WP04, 1, at(46))!;
    assert.equal(hot.level, "critical");
    assert.equal(hot.simulated, true);
    assert.match(hot.detail, /45°C operating limit/);
  });

  test("dock charger alert above 40C", () => {
    const at = (c: number) => c - HEAT.baseC - HEAT.zoneC.ACCESS - HEAT.floor2C;
    assert.equal(dockChargerAlert(stop.WP15, 1, at(LIMITS.chargerMaxC - 0.5)), null);
    assert.match(dockChargerAlert(stop.WP15, 1, at(41))!.detail, /charger's 40°C limit/);
  });
});

describe("alerts from the data", () => {
  test("a failed step becomes a warning (not simulated)", () => {
    const a = action("A0001"); // M001 navigation to WP05: OBSTACLE_DETECTION
    const alerts = actionAlerts(a, data.readings, stop.WP05);
    const fail = alerts.find(x => x.id === "fail-A0001")!;
    assert.equal(fail.level, "warning");
    assert.equal(fail.simulated, false);
    assert.match(fail.title, /Obstacle detected at Pipe Gallery/);
  });

  test("low battery below 20%", () => {
    const a = action("A0010"); // M001's last step, battery 15%
    assert.ok(actionAlerts(a, data.readings, stop[a.location_id]).some(x => x.title === "Low battery: 15%"));
  });

  test("low localization confidence", () => {
    const a = action("A0001"); // R0010: 44.4%
    assert.ok(actionAlerts(a, data.readings, stop.WP05).some(x => x.id === "loc-R0010" && x.level === "warning"));
  });

  test("hot equipment: real 83.5C is a data warning; the heat wave pushes it past 90C (simulated critical)", () => {
    const a = action("A0228"); // R0120: HX-201 at 83.5 C
    const real = actionAlerts(a, data.readings, stop.WP05).find(x => x.id === "temp-R0120")!;
    assert.equal(real.level, "warning");
    assert.equal(real.simulated, false);
    const hot = actionAlerts(a, data.readings, stop.WP05, 10).find(x => x.id === "temp-R0120")!;
    assert.equal(hot.level, "critical");
    assert.equal(hot.simulated, true);
    assert.match(hot.detail, /83.5°C \+ 9°C/);
  });

  test("no data alert ever claims to be simulated, and every alert id is unique per mission", () => {
    for (const id of new Set(data.actions.map(a => a.mission_id))) {
      const ids = missionActions(data, id).flatMap(a => actionAlerts(a, data.readings, stop[a.location_id]));
      assert.ok(ids.every(x => !x.simulated), id);
      assert.equal(new Set(ids.map(x => x.id)).size, ids.length, id);
    }
  });
});

describe("obstacle in front of the dock (simulated)", () => {
  const nav = new NavGrid(map);
  const dock = stop.WP15;

  test("withBlocked blocks cells in a copy and leaves the original grid alone", () => {
    const c = Math.floor(dock.x / nav.cell), r = Math.floor(dock.y / nav.cell);
    const blocked = nav.withBlocked([{ x0: dock.x - 3, y0: dock.y - 3, x1: dock.x + 3, y1: dock.y + 3 }]);
    assert.equal(blocked.isWalkable(c, r), false);
    assert.equal(nav.isWalkable(c, r), true);
  });

  test("from every other stop: the obstacle sits on the approach, SPOT re-plans around it and still arrives", () => {
    for (const from of map.stops.filter(s => s.id !== dock.id)) {
      const leg = nav.route(from, dock).legs.at(-1)!;
      const box = obstacleOnApproach(leg);
      assert.ok(distToRect(dock.x, dock.y, box) > 0, `${from.id}: obstacle covers the dock itself`);
      // the planned route really goes through the obstacle
      const len = polylineLength(leg);
      let hits = false;
      for (let d = 0; d <= len; d += 1) { const p = pointAlong(leg, d); if (distToRect(p.x, p.y, box) === 0) hits = true; }
      assert.ok(hits, `${from.id}: obstacle not on the route`);
      // re-plan from where SPOT stops (a bit before the obstacle) and check the new route avoids it
      let stopAt = 0;
      for (let d = 0; d <= len; d += 1) { const p = pointAlong(leg, d); if (distToRect(p.x, p.y, box) <= 25) { stopAt = d; break; } }
      const here = pointAlong(leg, stopAt);
      const detour = nav.withBlocked([box]).route(here, dock).legs[0];
      const dl = polylineLength(detour);
      for (let d = 0; d <= dl; d += 0.5) {
        const p = pointAlong(detour, d);
        assert.ok(distToRect(p.x, p.y, box) > 0, `${from.id}: detour enters the obstacle at (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
      }
    }
  });

  test("alert wording: warning when re-routed, critical when the dock can't be reached", () => {
    assert.equal(dockObstacleAlert(dock, true).level, "warning");
    assert.equal(dockObstacleAlert(dock, false).level, "critical");
    assert.ok(dockObstacleAlert(dock, true).simulated);
  });
});
