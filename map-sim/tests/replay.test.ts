/**
 * Tests for the replay logic the sandbox runs (src/sim/replay.ts): the alert
 * feed, whole-mission replays, and the state a finished replay leaves behind.
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AlertFeed, MissionRun } from "../src/sim/replay.ts";
import { componentHealth } from "../src/sim/health.ts";
import type { Alert, MissionData } from "../src/sim/scenario.ts";
import type { MapData, Stop } from "../src/sim/types.ts";

const map: MapData = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
const data: MissionData = JSON.parse(readFileSync(new URL("../data/missions.json", import.meta.url), "utf8"));
const stops = Object.fromEntries(map.stops.map(s => [s.id, s])) as Record<string, Stop>;
const health = componentHealth(data);
const newRun = (id: string) => new MissionRun(data, health, stops, stops.WP15, id);

const alert = (id: string, level: Alert["level"]): Alert =>
  ({ id, level, simulated: true, title: id, detail: level, location_id: null, action_id: null });

describe("alert feed", () => {
  test("the same alert twice is shown once", () => {
    const feed = new AlertFeed();
    assert.ok(feed.add(alert("a", "warning")));
    assert.equal(feed.add(alert("a", "warning")), null);
    assert.equal(feed.list.length, 1);
  });

  test("a more severe repeat replaces the entry and moves it to the top; a milder one is ignored", () => {
    const feed = new AlertFeed();
    feed.add(alert("a", "warning"), "10:00:00");
    feed.add(alert("b", "info"));
    const up = feed.add(alert("a", "critical"), "10:05:00");
    assert.equal(up?.level, "critical");
    assert.deepEqual(feed.list.map(x => `${x.id}:${x.level}`), ["a:critical", "b:info"]);
    assert.equal(feed.get("a")?.at, "10:05:00");
    assert.equal(feed.add(alert("a", "warning")), null);
    assert.equal(feed.count("critical"), 1);
    assert.equal(feed.count("warning"), 0);
  });
});

describe("mission replays", () => {
  test("M014 with a +12C heat wave: PANEL-215's life alert escalates from warning (A0137) to critical (A0140)", () => {
    const run = newRun("M014");
    const at = (actionId: string) => run.actions.findIndex(a => a.action_id === actionId);
    // step through like the sandbox does, checking the alert after each PANEL-215 inspection
    for (let i = 0; i < run.actions.length; i++) {
      if (run.beginAction(i, 12).skip) continue;
      run.completeAction(i, 12);
      if (i === at("A0137")) assert.equal(run.feed.get("life-PANEL-215")?.level, "warning");
    }
    run.finish();
    const life = run.feed.list.filter(a => a.id === "life-PANEL-215");
    assert.equal(life.length, 1, "one entry, updated in place");
    assert.equal(life[0].level, "critical");
    assert.equal(life[0].action_id, "A0140");
    assert.ok(run.feed.count("critical") >= 1);
  });

  test("M014 without a heat wave: PANEL-215 stays a warning", () => {
    const run = newRun("M014").runAll(0);
    assert.equal(run.feed.get("life-PANEL-215")?.level, "warning");
  });

  test("a stop that is too hot is skipped: no data alerts for that step", () => {
    const run = newRun("M001");
    const skipped: string[] = [];
    run.actions.forEach((a, i) => { if (run.beginAction(i, 16).skip) skipped.push(a.action_id); else run.completeAction(i, 16); });
    assert.ok(skipped.length > 0, "the +16C heat wave should make SPOT skip something in M001");
    for (const id of skipped) assert.ok(run.feed.list.every(a => a.action_id !== id || a.id.startsWith("heat-")), id);
  });

  test("every mission replays without errors, with and without the heat wave", () => {
    for (const id of new Set(data.actions.map(a => a.mission_id))) {
      for (const heat of [0, 16]) {
        const run = newRun(id).runAll(heat);
        assert.ok(run.finished, `${id} +${heat}`);
        assert.equal(new Set(run.feed.list.map(a => a.id)).size, run.feed.list.length, `${id}: duplicate feed entries`);
      }
    }
  });
});

describe("replay progress (drives the heat wave display)", () => {
  test("starts at 0 and follows the current step", () => {
    const run = newRun("M001");
    assert.equal(run.progress, 0);
    assert.equal(run.extraC(16), 8);       // half the heat wave before the first step
    const { step } = run.beginAction(4, 16);
    assert.equal(run.progress, step.prog);
  });

  test("a finished replay keeps the end-of-mission heat: progress 1, full +16C, no current step", () => {
    const run = newRun("M001").runAll(16);
    assert.equal(run.finished, true);
    assert.equal(run.step, null);
    assert.equal(run.progress, 1);
    assert.equal(run.extraC(16), 16);
    assert.equal(run.at, "");
  });
});
