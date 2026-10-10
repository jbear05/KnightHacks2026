/**
 * Tests for SPOT's motion logic (not the pixels; those are checked by eye in the sandbox).
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { angleDiff, turnToward, SpotAnimator, headingAlong } from "../src/sim/spot.ts";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

describe("turning", () => {
  test("angleDiff takes the short way round", () => {
    close(angleDiff(0, Math.PI / 2), Math.PI / 2);
    close(angleDiff(0.1, 2 * Math.PI - 0.1), -0.2, 1e-12);   // across 0, not the long way
    close(angleDiff(3, -3), 2 * Math.PI - 6, 1e-12);          // across +-PI
  });
  test("turnToward never overshoots and never exceeds the max step", () => {
    close(turnToward(0, 1, 0.3), 0.3);
    close(turnToward(0, 0.1, 0.3), 0.1);
    close(turnToward(0, -1, 0.3), -0.3);
  });
});

describe("SpotAnimator", () => {
  const BODY = 40, DT = 1 / 60;

  test("legs move while walking, and stop (and settle) when SPOT stops", () => {
    const a = new SpotAnimator(0);
    a.reset(0, 0);
    for (let i = 1; i <= 60; i++) a.update(i * 1, 0, DT, BODY);      // walk 60 px right
    assert.ok(a.walking > 0.9, "should be in walking pose");
    const g = a.gait;
    for (let i = 0; i < 60; i++) a.update(60, 0, DT, BODY);          // stand still 1 s
    close(a.gait, g);                                                 // no leg motion
    assert.ok(a.walking < 0.01, "legs should settle to standing");
  });

  test("leg speed follows distance walked", () => {
    const slow = new SpotAnimator(0), fast = new SpotAnimator(0);
    slow.reset(0, 0); fast.reset(0, 0);
    let gs = 0, gf = 0;
    for (let i = 1; i <= 10; i++) {
      const ps = slow.gait, pf = fast.gait;
      slow.update(i * 0.5, 0, DT, BODY); fast.update(i * 1.0, 0, DT, BODY);
      gs += (slow.gait - ps + 2 * Math.PI) % (2 * Math.PI);
      gf += (fast.gait - pf + 2 * Math.PI) % (2 * Math.PI);
    }
    close(gf / gs, 2, 1e-6); // twice the distance = twice the steps
  });

  test("at 60x the legs are capped, so they never flicker", () => {
    const a = new SpotAnimator(0, { maxGaitHz: 3 });
    a.reset(0, 0);
    let total = 0;
    for (let i = 1; i <= 60; i++) {                                  // 1 s, moving 50 px per frame
      const p = a.gait; a.update(i * 50, 0, DT, BODY);
      total += (a.gait - p + 2 * Math.PI) % (2 * Math.PI);
    }
    assert.ok(total / (2 * Math.PI) <= 3 + 1e-6, `${(total / 2 / Math.PI).toFixed(2)} cycles in 1 s`);
  });

  test("turns smoothly toward the direction of travel", () => {
    const a = new SpotAnimator(0, { turnRate: Math.PI });            // 180 deg per second
    a.reset(0, 0, 0);
    a.update(0, 10, 0.25, BODY);                                       // start moving down (+y)
    close(a.heading, Math.PI / 4, 1e-9);                               // only a quarter second of turning
    for (let i = 0; i < 10; i++) a.update(0, 20 + i * 10, 0.25, BODY);
    close(a.heading, Math.PI / 2, 1e-9);                               // eventually faces down
  });

  test("reset (teleport, e.g. stairs or seeking) does not animate legs", () => {
    const a = new SpotAnimator(0);
    a.reset(0, 0);
    const g = a.gait;
    a.reset(500, 500);
    a.update(500, 500, DT, BODY);
    close(a.gait, g);
  });
});

describe("headingAlong", () => {
  const L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  test("direction of the segment SPOT is on", () => {
    close(headingAlong(L, 5), 0);
    close(headingAlong(L, 15), Math.PI / 2);
  });
  test("past the end keeps the last direction; zero-length path gives 0", () => {
    close(headingAlong(L, 999), Math.PI / 2);
    close(headingAlong([{ x: 3, y: 3 }, { x: 3, y: 3 }], 0), 0);
  });
});
