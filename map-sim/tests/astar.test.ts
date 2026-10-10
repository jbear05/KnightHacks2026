/**
 * Tests for the pathfinding. No other part of the project is needed.
 *
 *   npm test
 *
 * Two kinds of tests:
 *  A. Small hand-made grids where we know the right answer exactly.
 *  B. The real map: every one of the 210 stop-to-stop routes is checked against
 *     the rules the robot must never break.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NavGrid, pointAlong, polylineLength } from "../src/sim/astar.ts";
import type { MapData, Pt, Route } from "../src/sim/types.ts";

// ---------------------------------------------------------------- helpers

/** Build a tiny map from ASCII art. Each char = one 10 px cell. */
function tinyMap(art: string[], stairs?: MapData["stairs"]): MapData {
  return {
    image: "", width: art[0].length * 10, height: art.length * 10, stops: [], floors: {},
    grid: { cell: 10, cols: art[0].length, rows_count: art.length, rows: art },
    stairs: stairs ?? { F1: { x: 5, y: 5, floor: 1 }, F2: { x: 5, y: 5, floor: 2 }, cost_sec: 0 },
  };
}
const at = (c: number, r: number, floor = 1): Pt => ({ x: c * 10 + 5, y: r * 10 + 5, floor });

/** True if every pixel along the route is on a walkable cell. */
function staysOnWalkable(nav: NavGrid, route: Route): string | null {
  for (const leg of route.legs) {
    const len = polylineLength(leg);
    for (let d = 0; d <= len; d += 0.5) {
      const p = pointAlong(leg, d);
      const c = Math.floor(p.x / nav.cell), r = Math.floor(p.y / nav.cell);
      if (!nav.isWalkable(c, r)) return `(${p.x.toFixed(1)},${p.y.toFixed(1)}) cell ${c},${r}`;
    }
  }
  return null;
}

/**
 * Independent shortest-path check (Dijkstra, same move rules as A*).
 * Written separately on purpose: if A* has a bug, this one won't share it.
 */
function dijkstraCells(nav: NavGrid, [sc, sr]: number[], [gc, gr]: number[]): number {
  const W = nav.cols, H = nav.rows, dist = new Float64Array(W * H).fill(Infinity);
  const done = new Uint8Array(W * H);
  dist[sr * W + sc] = 0;
  const open: number[] = [sr * W + sc];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === gr * W + gc) return dist[cur];
    const c = cur % W, r = (cur / W) | 0;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (!nav.isWalkable(nc, nr)) continue;
      if (dc && dr && (!nav.isWalkable(c + dc, r) || !nav.isWalkable(c, r + dr))) continue;
      const n = nr * W + nc, nd = dist[cur] + (dc && dr ? Math.SQRT2 : 1);
      if (nd < dist[n]) { dist[n] = nd; open.push(n); }
    }
  }
  return Infinity;
}

// ---------------------------------------------------------------- A. tiny grids

describe("A. small grids with known answers", () => {
  test("straight corridor: one straight segment, exact length", () => {
    const nav = new NavGrid(tinyMap(["#####"]));
    const r = nav.route(at(0, 0), at(4, 0));
    assert.equal(r.legs.length, 1);
    assert.equal(r.legs[0].length, 2, "string-pulling should leave just start and end");
    assert.equal(r.lengthPx, 40);
  });

  test("goes around a wall instead of through it", () => {
    const nav = new NavGrid(tinyMap([
      "#####",   // the only way past the wall is this top row
      "##.##",   // wall in the middle column
      "##.##",
      "##.##",
    ]));
    // from bottom-left to bottom-right: must climb to row 0 to get past column 2
    const r = nav.route(at(0, 3), at(4, 3));
    assert.equal(staysOnWalkable(nav, r), null);
    const ys = r.legs[0].map(p => p.y);
    assert.ok(Math.min(...ys) <= 5, "path must pass through the top row");
  });

  test("never squeezes diagonally between two wall corners", () => {
    // the only way from top-left to bottom-right would be the diagonal gap
    const nav = new NavGrid(tinyMap([
      "#.",
      ".#",
    ]));
    assert.throws(() => nav.route(at(0, 0), at(1, 1)), /No walkable path/);
  });

  test("unreachable target gives a clear error, not a hang or a wrong path", () => {
    const nav = new NavGrid(tinyMap(["##.##"]));
    assert.throws(() => nav.route(at(0, 0), at(4, 0)), /No walkable path/);
  });

  test("start or end on a blocked cell (or off the map) is an error, not a path out of a wall", () => {
    const nav = new NavGrid(tinyMap(["##.##"]));
    assert.throws(() => nav.route(at(2, 0), at(0, 0)), /not on a walkable cell/);
    assert.throws(() => nav.route(at(0, 0), at(2, 0)), /not on a walkable cell/);
    assert.throws(() => nav.route({ x: -50, y: -50, floor: 1 }, at(0, 0)), /not on a walkable cell/);
  });

  test("start equals goal: zero-length route", () => {
    const nav = new NavGrid(tinyMap(["###"]));
    const r = nav.route(at(1, 0), at(1, 0));
    assert.equal(r.lengthPx, 0);
  });

  test("open room: diagonal is a single straight line", () => {
    const nav = new NavGrid(tinyMap(["#####", "#####", "#####", "#####", "#####"]));
    const r = nav.route(at(0, 0), at(4, 4));
    assert.equal(r.legs[0].length, 2);
    assert.ok(Math.abs(r.lengthPx - Math.hypot(40, 40)) < 1e-9);
  });

  test("changing floor goes through both ends of the stairs", () => {
    // two separate 'floors' side by side, stairs at column 1 and column 5
    const nav = new NavGrid(tinyMap(["###.###"], {
      F1: { x: 15, y: 5, floor: 1 }, F2: { x: 55, y: 5, floor: 2 }, cost_sec: 10,
    }));
    const r = nav.route(at(0, 0, 1), at(6, 0, 2));
    assert.equal(r.usesStairs, true);
    assert.equal(r.legs.length, 2);
    assert.deepEqual([r.legs[0].at(-1)!.x, r.legs[1][0].x], [15, 55]);
  });
});

// ---------------------------------------------------------------- B. real map

describe("B. the real floor plan, all 210 stop pairs", () => {
  const map: MapData = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  const nav = new NavGrid(map);
  const floorRange = (m: MapData, f: number) => m.floors[String(f)];
  const pairs = map.stops.flatMap(a => map.stops.filter(b => b.id !== a.id).map(b => [a, b] as const));

  test("map sanity: 15 stops, each on a walkable cell", () => {
    assert.equal(map.stops.length, 15);
    for (const s of map.stops)
      assert.ok(nav.isWalkable(Math.floor(s.x / nav.cell), Math.floor(s.y / nav.cell)), s.id);
  });

  test("rooms are sealed: the cells just outside each room are blocked except at its doors", () => {
    // Same rule build_grid.py uses: a cell belongs to a rect if its centre is inside.
    const C = nav.cell;
    const has = (r: { x0: number; y0: number; x1: number; y1: number }, c: number, row: number) => {
      const x = (c + 0.5) * C, y = (row + 0.5) * C;
      return r.x0 <= x && x < r.x1 && r.y0 <= y && y < r.y1;
    };
    const rects = map.walk_rects ?? [];
    const rooms = rects.filter(r => /^WP\d\d .*(room|area|bay|dock)$/i.test(r.label));
    const openings = rects.filter(r => /^door |stairs/.test(r.label));
    assert.ok(rooms.length >= 10, `expected the room rects in map.json, found ${rooms.length}`);
    const problems: string[] = [];
    for (const room of rooms) {
      const c0 = Math.ceil(room.x0 / C - 0.5), c1 = Math.ceil(room.x1 / C - 0.5) - 1;
      const r0 = Math.ceil(room.y0 / C - 0.5), r1 = Math.ceil(room.y1 / C - 0.5) - 1;
      const ring: [number, number][] = [];
      for (let c = c0; c <= c1; c++) ring.push([c, r0 - 1], [c, r1 + 1]);
      for (let r = r0; r <= r1; r++) ring.push([c0 - 1, r], [c1 + 1, r]);
      const leaks = ring.filter(([c, r]) => nav.isWalkable(c, r) && !openings.some(o => has(o, c, r)));
      if (leaks.length) problems.push(`${room.label}: ${leaks.length} open wall cells, e.g. ${leaks.slice(0, 3).map(([c, r]) => `(${c * C},${r * C})`).join(" ")}`);
    }
    assert.deepEqual(problems, [], "rooms with a hole in the wall (fix the rects in tools/build_grid.py)");
  });

  test("every pair has a route", () => {
    for (const [a, b] of pairs) assert.doesNotThrow(() => nav.route(a, b), `${a.id}->${b.id}`);
  });

  test("no route ever crosses a blocked cell (checked every 0.5 px)", () => {
    for (const [a, b] of pairs) {
      const bad = staysOnWalkable(nav, nav.route(a, b));
      assert.equal(bad, null, `${a.id}->${b.id} hits a wall at ${bad}`);
    }
  });

  test("routes start and end exactly on the stops", () => {
    for (const [a, b] of pairs) {
      const r = nav.route(a, b), first = r.legs[0][0], last = r.legs.at(-1)!.at(-1)!;
      assert.deepEqual([first.x, first.y, last.x, last.y], [a.x, a.y, b.x, b.y], `${a.id}->${b.id}`);
    }
  });

  test("floors: stairs used exactly when the floor changes, never wander onto the other floor", () => {
    for (const [a, b] of pairs) {
      const r = nav.route(a, b);
      assert.equal(r.usesStairs, a.floor !== b.floor, `${a.id}->${b.id}`);
      assert.equal(r.legs.length, a.floor !== b.floor ? 2 : 1);
      for (const leg of r.legs) {
        const f = leg[0].floor, box = floorRange(map, f);
        for (const p of leg) {
          assert.equal(p.floor, f);
          assert.ok(p.x >= box.x0 && p.x <= box.x1, `${a.id}->${b.id}: point on wrong floor`);
        }
      }
    }
  });

  test("routes are shortest: never longer than an independent Dijkstra check", () => {
    // Smoothed path must be <= the best grid path (+ a cell of slack at each end,
    // because stops sit inside cells, not on cell centres).
    const slack = 2 * nav.cell * Math.SQRT2;
    const toCell = (p: Pt) => [Math.floor(p.x / nav.cell), Math.floor(p.y / nav.cell)];
    for (const [a, b] of pairs) {
      if (a.floor !== b.floor) continue; // cross-floor routes: checked per leg in the next test
      const best = dijkstraCells(nav, toCell(a), toCell(b)) * nav.cell;
      const got = nav.route(a, b).lengthPx;
      assert.ok(got <= best + slack, `${a.id}->${b.id}: ${got.toFixed(0)} px vs best ${best.toFixed(0)} px`);
      assert.ok(got >= Math.hypot(a.x - b.x, a.y - b.y) - 1e-6, "shorter than a straight line?!");
    }
  });

  test("cross-floor routes are shortest on each leg (stop <-> stairs)", () => {
    const slack = 2 * nav.cell * Math.SQRT2;
    const toCell = (p: Pt) => [Math.floor(p.x / nav.cell), Math.floor(p.y / nav.cell)];
    for (const [a, b] of pairs) {
      if (a.floor === b.floor) continue;
      for (const leg of nav.route(a, b).legs) {
        const s = leg[0], e = leg.at(-1)!;
        const best = dijkstraCells(nav, toCell(s), toCell(e)) * nav.cell;
        const got = polylineLength(leg);
        assert.ok(got <= best + slack, `${a.id}->${b.id} leg F${s.floor}: ${got.toFixed(0)} px vs best ${best.toFixed(0)} px`);
      }
    }
  });

  test("A->B and B->A are the same length (within one cell)", () => {
    for (const [a, b] of pairs) {
      const d = Math.abs(nav.route(a, b).lengthPx - nav.route(b, a).lengthPx);
      assert.ok(d <= nav.cell * 2, `${a.id}<->${b.id} differ by ${d.toFixed(1)} px`);
    }
  });

  test("fast enough for the browser: all 210 routes from cold in under 2 s", () => {
    const fresh = new NavGrid(map), t0 = performance.now();
    for (const [a, b] of pairs) fresh.route(a, b);
    const ms = performance.now() - t0;
    assert.ok(ms < 2000, `${ms.toFixed(0)} ms`);
  });
});

// ---------------------------------------------------------------- pointAlong

describe("pointAlong (used to move the robot)", () => {
  const line: Pt[] = [{ x: 0, y: 0, floor: 1 }, { x: 10, y: 0, floor: 1 }, { x: 10, y: 10, floor: 1 }];
  test("start, end and clamping", () => {
    assert.deepEqual(pointAlong(line, 0), line[0]);
    assert.deepEqual(pointAlong(line, 20), line[2]);
    assert.deepEqual(pointAlong(line, 999), line[2]);
    assert.deepEqual(pointAlong(line, -5), line[0]);
  });
  test("goes round corners correctly", () => {
    assert.deepEqual(pointAlong(line, 5), { x: 5, y: 0, floor: 1 });
    assert.deepEqual(pointAlong(line, 15), { x: 10, y: 5, floor: 1 });
  });
});
