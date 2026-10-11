/**
 * A* pathfinding on the walkable grid in map.json.
 *
 * Why a grid (and not a hand-made graph of corridor nodes): the grid comes
 * straight from tracing the image, so if a wall or door is wrong you fix it by
 * painting cells, and every route updates. No route is ever hand-written.
 *
 * - 8-directional moves, diagonal cost sqrt(2), no cutting through wall corners.
 * - Octile-distance heuristic (admissible for 8-dir), so paths are shortest.
 * - Raw grid paths zig-zag, so we "string-pull" them: keep only the corners
 *   where a straight line would hit a wall. The robot then walks clean lines.
 * - Floors: the two floors sit side by side in one image with no walkable
 *   cell between them. A route that changes floor = A* to this floor's
 *   stairs and along its flight, then the other floor's flight and A* on.
 */
import type { MapData, Pt, Route } from "./types.ts";

const SQRT2 = Math.SQRT2;
/** Smoothed paths keep at least this many px away from any blocked cell. */
const CLEARANCE = 1;

export class NavGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  private walk: Uint8Array;
  private map: MapData;
  private cache = new Map<string, Route>();

  constructor(map: MapData) {
    this.map = map;
    this.cell = map.grid.cell;
    this.cols = map.grid.cols;
    this.rows = map.grid.rows_count;
    this.walk = new Uint8Array(this.cols * this.rows);
    map.grid.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) this.walk[r * this.cols + c] = row[c] === "#" ? 1 : 0;
    });
  }

  /**
   * A copy of this grid with extra blocked areas, e.g. an obstacle SPOT just
   * found. Rects are in image pixels; every cell the rect touches is blocked,
   * so routes never graze it. The original grid is not changed.
   */
  withBlocked(rects: { x0: number; y0: number; x1: number; y1: number }[]): NavGrid {
    const copy = new NavGrid(this.map);
    copy.walk.set(this.walk);
    for (const b of rects) {
      const c0 = Math.max(0, Math.floor(b.x0 / this.cell)), c1 = Math.min(this.cols - 1, Math.floor(b.x1 / this.cell));
      const r0 = Math.max(0, Math.floor(b.y0 / this.cell)), r1 = Math.min(this.rows - 1, Math.floor(b.y1 / this.cell));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) copy.walk[r * this.cols + c] = 0;
    }
    return copy;
  }

  isWalkable(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.walk[r * this.cols + c] === 1;
  }

  private toCell(p: { x: number; y: number }): [number, number] {
    return [Math.floor(p.x / this.cell), Math.floor(p.y / this.cell)];
  }

  private toPx(c: number, r: number, floor: number): Pt {
    return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell, floor };
  }

  /** Route between two map points, across floors if needed. Cached. */
  route(from: Pt, to: Pt): Route {
    const key = `${from.x},${from.y},${from.floor}>${to.x},${to.y},${to.floor}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    let legs: Pt[][];
    if (from.floor === to.floor) {
      legs = [this.leg(from, to)];
    } else {
      const s = this.map.stairs;
      const a = from.floor === 1 ? s.F1 : s.F2;
      const b = to.floor === 1 ? s.F1 : s.F2;
      const leaving = this.leg(from, { ...a }), arriving = this.leg({ ...b }, to);
      // Walk the flights as drawn: up/down this floor's flight to its far end, then (after the
      // floor change) from the far end of the other floor's flight back to its landing.
      const farA = s.flight?.[from.floor === 1 ? "F1" : "F2"]?.at(-1);
      const farB = s.flight?.[to.floor === 1 ? "F1" : "F2"]?.at(-1);
      if (farA) leaving.push({ x: farA.x, y: farA.y, floor: from.floor });
      if (farB) arriving.unshift({ x: farB.x, y: farB.y, floor: to.floor });
      legs = [leaving, arriving];
    }
    const route: Route = {
      legs,
      lengthPx: legs.reduce((sum, l) => sum + polylineLength(l), 0),
      usesStairs: legs.length > 1,
    };
    this.cache.set(key, route);
    return route;
  }

  /** One same-floor polyline, starting and ending exactly at the given pixels. */
  private leg(from: Pt, to: Pt): Pt[] {
    for (const p of [from, to]) {
      const [c, r] = this.toCell(p);
      if (!this.isWalkable(c, r)) throw new Error(`${fmt(p)} is not on a walkable cell. Check the grid.`);
    }
    const cells = this.search(this.toCell(from), this.toCell(to));
    if (!cells) throw new Error(`No walkable path ${fmt(from)} -> ${fmt(to)}. Check the grid.`);
    const pulled = this.stringPull(cells);
    // Keep the cell centres and add the exact stop pixels on each end.
    // (from -> its own cell centre) stays inside one walkable cell (checked above), so it is always safe.
    const pts = [{ ...from }, ...pulled.map(([c, r]) => this.toPx(c, r, from.floor)), { ...to }];
    return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  }

  /** Plain A*. Returns the list of cells from start to goal, or null. */
  private search([sc, sr]: [number, number], [gc, gr]: [number, number]): [number, number][] | null {
    const N = this.cols * this.rows;
    const g = new Float64Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const h = (c: number, r: number) => {
      const dx = Math.abs(c - gc), dy = Math.abs(r - gr);
      return dx + dy + (SQRT2 - 2) * Math.min(dx, dy); // octile distance
    };
    const start = sr * this.cols + sc, goal = gr * this.cols + gc;
    g[start] = 0;
    heap.push(start, h(sc, sr));

    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const c = cur % this.cols, r = (cur / this.cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = c + dc, nr = r + dr;
          if (!this.isWalkable(nc, nr)) continue;
          // diagonal: both side cells must be open, so we never clip a wall corner
          if (dc && dr && (!this.isWalkable(c + dc, r) || !this.isWalkable(c, r + dr))) continue;
          const n = nr * this.cols + nc;
          const ng = g[cur] + (dc && dr ? SQRT2 : 1);
          if (ng < g[n]) {
            g[n] = ng;
            parent[n] = cur;
            heap.push(n, ng + h(nc, nr));
          }
        }
      }
    }
    if (g[goal] === Infinity) return null;
    const out: [number, number][] = [];
    for (let n = goal; n !== -1; n = parent[n]) out.push([n % this.cols, (n / this.cols) | 0]);
    return out.reverse();
  }

  /** Drop intermediate cells while the straight line stays on walkable cells. */
  private stringPull(cells: [number, number][]): [number, number][] {
    if (cells.length <= 2) return cells;
    const out = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.lineOfSight(cells[anchor], cells[i])) {
        anchor = i - 1;
        out.push(cells[anchor]);
      }
    }
    out.push(cells[cells.length - 1]);
    return out;
  }

  /**
   * Is the straight segment between two cell centres clear?
   * Checked in pixel space: we walk the segment in small steps and require a
   * small square (CLEARANCE px around each sample) to be on walkable cells.
   * This also catches lines that run exactly along a wall edge or through a
   * wall corner, which a pure cell-index walk can miss.
   */
  private lineOfSight([c0, r0]: [number, number], [c1, r1]: [number, number]): boolean {
    const ax = (c0 + 0.5) * this.cell, ay = (r0 + 0.5) * this.cell;
    const bx = (c1 + 0.5) * this.cell, by = (r1 + 0.5) * this.cell;
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / (this.cell / 4)));
    const k = CLEARANCE;
    for (let i = 0; i <= steps; i++) {
      const x = ax + ((bx - ax) * i) / steps, y = ay + ((by - ay) * i) / steps;
      if (!this.walkPx(x - k, y - k) || !this.walkPx(x + k, y - k) ||
          !this.walkPx(x - k, y + k) || !this.walkPx(x + k, y + k)) return false;
    }
    return true;
  }

  private walkPx(x: number, y: number): boolean {
    return this.isWalkable(Math.floor(x / this.cell), Math.floor(y / this.cell));
  }
}

export function polylineLength(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

/** Point at distance `d` along a polyline (clamped). */
export function pointAlong(pts: Pt[], d: number): Pt {
  if (d <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg) {
      const t = seg ? d / seg : 0;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
        floor: pts[i].floor,
      };
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

const fmt = (p: Pt) => `(${Math.round(p.x)},${Math.round(p.y)} F${p.floor})`;

/** Tiny binary min-heap keyed by f-score. */
class MinHeap {
  private ids: number[] = [];
  private fs: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, f: number) {
    this.ids.push(id); this.fs.push(f);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fs[p] <= this.fs[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!, lastF = this.fs.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId; this.fs[0] = lastF;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.ids.length && this.fs[l] < this.fs[m]) m = l;
        if (r < this.ids.length && this.fs[r] < this.fs[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.fs[a], this.fs[b]] = [this.fs[b], this.fs[a]];
  }
}
