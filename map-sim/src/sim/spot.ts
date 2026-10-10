/**
 * Top-down SPOT robot dog, drawn with plain Canvas 2D (no images, no libraries).
 *
 * Why draw it in code instead of using a sprite/GIF:
 *  - the legs are driven by distance walked, so they stop when SPOT stops and
 *    stay in sync at 1x, 10x and 60x
 *  - it rotates to any heading, and scales to any map size, staying sharp
 *  - states (walking, inspecting, failed) are just parameters
 *
 * Split in two:
 *  - SpotAnimator: pure motion state (heading smoothing + gait phase). Testable.
 *  - drawSpot():  draws one frame from that state.
 */

export type SpotMode = "idle" | "walk" | "inspect" | "fail";

export interface SpotPose {
  x: number;            // canvas px
  y: number;
  heading: number;      // radians, 0 = facing right (+x), PI/2 = facing down
  gait: number;         // leg cycle phase, radians
  walking: number;      // 0..1, blends legs between standing and trotting
  mode: SpotMode;
  size: number;         // body length in canvas px
  t: number;            // seconds, for pulsing effects
  halo?: boolean;       // soft light disc under SPOT so it stands out on a busy map (default true)
}

// ------------------------------------------------------------------ motion

/** Smallest signed angle from a to b, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Rotate `current` toward `target` by at most `maxStep` radians, the short way round. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDiff(current, target);
  return Math.abs(d) <= maxStep ? target : current + Math.sign(d) * maxStep;
}

export interface AnimatorOptions {
  turnRate?: number;      // rad per real second
  strideBodies?: number;  // distance per full leg cycle, in body lengths
  maxGaitHz?: number;     // cap leg cycles per real second (60x would just flicker)
}

/**
 * Keeps SPOT's heading and leg phase between frames.
 * Call update() once per animation frame with where SPOT is now.
 */
export class SpotAnimator {
  heading: number;
  gait = 0;
  walking = 0;
  private last: { x: number; y: number } | null = null;
  private opt: Required<AnimatorOptions>;

  constructor(initialHeading = 0, opt: AnimatorOptions = {}) {
    this.heading = initialHeading;
    this.opt = { turnRate: 7, strideBodies: 0.9, maxGaitHz: 3.2, ...opt };
  }

  /**
   * @param x,y          SPOT position this frame (same units as bodyLen)
   * @param dt           real seconds since last frame
   * @param bodyLen      body length in the same units as x,y
   * @param faceHeading  optional direction to face (e.g. from the path); else the movement direction
   */
  update(x: number, y: number, dt: number, bodyLen: number, faceHeading?: number): void {
    const moved = this.last ? Math.hypot(x - this.last.x, y - this.last.y) : 0;
    const target = faceHeading ?? (moved > 1e-6 && this.last ? Math.atan2(y - this.last.y, x - this.last.x) : this.heading);
    this.heading = turnToward(this.heading, target, this.opt.turnRate * dt);

    // legs: one full cycle per stride, but never faster than maxGaitHz
    const stride = this.opt.strideBodies * bodyLen;
    const cycles = Math.min(moved / stride, this.opt.maxGaitHz * dt);
    this.gait = (this.gait + cycles * 2 * Math.PI) % (2 * Math.PI);

    // ease legs in/out instead of snapping between standing and walking
    const goal = moved > 1e-6 ? 1 : 0;
    const k = Math.min(1, dt * 8);
    this.walking += (goal - this.walking) * k;
    this.last = { x, y };
  }

  /** Teleport (e.g. after seeking): no leg movement for the jump. */
  reset(x: number, y: number, heading = this.heading): void {
    this.last = { x, y };
    this.heading = heading;
    this.walking = 0;
  }
}

// ------------------------------------------------------------------ drawing

const C = {
  body: "#f2c200", bodyEdge: "#7a6200", panel: "#1c1c1e", leg: "#2a2a2d",
  foot: "#111", eye: "#7fd6ff", shadow: "rgba(0,0,0,0.22)",
  scan: "rgba(80,210,255,", fail: "rgba(255,70,70,",
};

/**
 * Leg layout, body-local coords in body lengths (+x = front, +y = right side).
 * Trot gait: diagonal pairs move together (front-left with rear-right).
 */
const LEGS = [
  { hx: 0.30, side: -1, phase: 0 },        // front-left
  { hx: 0.30, side: +1, phase: Math.PI },  // front-right
  { hx: -0.30, side: -1, phase: Math.PI }, // rear-left
  { hx: -0.30, side: +1, phase: 0 },       // rear-right
];

type Ctx = CanvasRenderingContext2D;

export function drawSpot(ctx: Ctx, p: SpotPose): void {
  const L = p.size;
  const bob = 1 + 0.025 * p.walking * Math.sin(p.gait * 2);

  ctx.save();
  ctx.translate(p.x, p.y);

  // effects that should not rotate with the body
  if (p.halo !== false) {
    const g = ctx.createRadialGradient(0, 0, L * 0.2, 0, 0, L * 0.85);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, L * 0.85, 0, Math.PI * 2); ctx.fill();
  }
  if (p.mode === "fail") {
    const a = 0.45 + 0.35 * Math.sin(p.t * 10);
    ctx.strokeStyle = C.fail + a + ")";
    ctx.lineWidth = L * 0.07;
    ctx.beginPath(); ctx.arc(0, 0, L * 0.85, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.rotate(p.heading);

  if (p.mode === "inspect") drawScanCone(ctx, L, p.t);

  // shadow
  ctx.fillStyle = C.shadow;
  ctx.beginPath(); ctx.ellipse(L * 0.05, L * 0.06, L * 0.46, L * 0.30, 0, 0, Math.PI * 2); ctx.fill();

  // legs (under the body)
  for (const leg of LEGS) drawLeg(ctx, L, leg, p);

  // body
  ctx.scale(bob, bob);
  roundRect(ctx, -0.40 * L, -0.17 * L, 0.80 * L, 0.34 * L, 0.10 * L);
  ctx.fillStyle = C.body; ctx.fill();
  ctx.lineWidth = Math.max(1, L * 0.025); ctx.strokeStyle = C.bodyEdge; ctx.stroke();

  // dark top panel + rear payload rails
  roundRect(ctx, -0.26 * L, -0.075 * L, 0.46 * L, 0.15 * L, 0.05 * L);
  ctx.fillStyle = C.panel; ctx.fill();
  ctx.fillStyle = C.bodyEdge;
  ctx.fillRect(-0.36 * L, -0.12 * L, 0.06 * L, 0.24 * L);

  // head / sensor block at the front, with two camera "eyes"
  roundRect(ctx, 0.30 * L, -0.15 * L, 0.16 * L, 0.30 * L, 0.06 * L);
  ctx.fillStyle = C.panel; ctx.fill();
  ctx.fillStyle = p.mode === "fail" ? "#ff5050" : C.eye;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(0.41 * L, s * 0.08 * L, 0.03 * L, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawLeg(ctx: Ctx, L: number, leg: (typeof LEGS)[number], p: SpotPose): void {
  const ph = p.gait + leg.phase;
  const swing = Math.sin(ph) * 0.13 * p.walking;            // foot forward/back
  const lift = Math.max(0, Math.cos(ph)) * p.walking;        // foot in the air
  const hipX = leg.hx * L, hipY = leg.side * 0.13 * L;
  const footX = (leg.hx + swing) * L;
  const footY = leg.side * (0.40 + 0.03 * lift) * L;
  // SPOT's knees bend backwards on all four legs
  const kneeX = (hipX + footX) / 2 - 0.10 * L;
  const kneeY = leg.side * 0.31 * L;

  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // lower leg (black), drawn first so the yellow thigh sits on top of the knee
  ctx.strokeStyle = C.leg; ctx.lineWidth = L * 0.075;
  ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
  // upper leg (yellow, like the real robot) with a dark outline
  ctx.strokeStyle = C.bodyEdge; ctx.lineWidth = L * 0.13;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
  ctx.strokeStyle = C.body; ctx.lineWidth = L * 0.09;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
  // lifted feet look bigger (closer to the camera above)
  ctx.fillStyle = C.foot;
  ctx.beginPath(); ctx.arc(footX, footY, L * (0.05 + 0.025 * lift), 0, Math.PI * 2); ctx.fill();
}

function drawScanCone(ctx: Ctx, L: number, t: number): void {
  const spread = 0.55, reach = L * 1.6;
  const pulse = (t * 1.2) % 1;
  const g = ctx.createRadialGradient(0.4 * L, 0, 0, 0.4 * L, 0, reach);
  g.addColorStop(0, C.scan + "0.55)");
  g.addColorStop(1, C.scan + "0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0.4 * L, 0);
  ctx.arc(0.4 * L, 0, reach, -spread, spread); ctx.closePath(); ctx.fill();
  // moving scan line
  ctx.strokeStyle = C.scan + (0.9 * (1 - pulse)) + ")";
  ctx.lineWidth = L * 0.04;
  ctx.beginPath(); ctx.arc(0.4 * L, 0, reach * (0.3 + 0.7 * pulse), -spread, spread); ctx.stroke();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Direction of travel at distance d along a polyline (radians). */
export function headingAlong(pts: { x: number; y: number }[], d: number): number {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (seg > 1e-9 && d <= acc + seg) return Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    acc += seg;
  }
  for (let i = pts.length - 1; i > 0; i--) {
    if (pts[i].x !== pts[i - 1].x || pts[i].y !== pts[i - 1].y)
      return Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
  }
  return 0;
}
