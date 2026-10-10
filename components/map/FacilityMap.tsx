"use client";

// <FacilityMap /> in live mode (contracts/facility-map-props.ts), built on Map & Sim's engine in
// map-sim/ (IliasCoder): NavGrid A* routes around the walls, and the animated SPOT drawn by
// drawSpot(). map-sim works in pixels of the kit's floorplan.png (1095 x 595); this component
// draws on the Figma cartoon plan (872 x 474), which is the same plan traced, so routes are moved
// across with one scale-and-shift per floor (every stop lands within 5 px) and then pinned
// exactly onto the Figma pins.
import { useEffect, useMemo, useRef, useState } from "react";
import type { FacilityMapLiveProps, LocationId, SpotStatus } from "@/contracts/facility-map-props";
import { LOCATIONS } from "@/lib/reference";
import { msOf, START_LOCATION } from "@/lib/replay";
import type { Action } from "@/lib/types";
import mapData from "@/map-sim/data/map.json";
import floorplan from "@/map-sim/public/floorplan.png";
import { NavGrid, SpotAnimator, drawSpot, headingAlong, pointAlong, polylineLength } from "@/map-sim/src/sim/index.ts";
import type { MapData, Pt, SpotMode } from "@/map-sim/src/sim/index.ts";

/** Pin centres and label offsets traced from the Figma frame (Live Mission 4:3, 872 x 474 plan). */
const PINS: Record<LocationId, { x: number; y: number; lx: number; ly: number }> = {
  WP01: { x: 86.01, y: 359.95, lx: 26, ly: 14 },
  WP02: { x: 89.99, y: 240.5, lx: 14, ly: -16 },
  WP03: { x: 201.48, y: 182.36, lx: -29.5, ly: 11.6 },
  WP04: { x: 171.21, y: 63.71, lx: 14, ly: -16 },
  WP05: { x: 355.97, y: 168.83, lx: 14, ly: -16 },
  WP06: { x: 437.38, y: 60.71, lx: 17, ly: -13 },
  WP07: { x: 527.98, y: 216.61, lx: -15, ly: 13.4 },
  WP08: { x: 301.02, y: 320.13, lx: 14, ly: -16 },
  WP09: { x: 434.99, y: 317.13, lx: -23, ly: 20.9 },
  WP10: { x: 535.15, y: 330.48, lx: -15.2, ly: 11.5 },
  WP11: { x: 676.1, y: 102.73, lx: 14, ly: -16 },
  WP12: { x: 796.35, y: 107.51, lx: 14, ly: -16 },
  WP13: { x: 665.75, y: 252.44, lx: 14, ly: -16 },
  WP14: { x: 789.18, y: 274.74, lx: 14, ly: -16 },
  WP15: { x: 712.73, y: 369.51, lx: 14, ly: -16 },
};

const W = 872;
const H = 474;

/** Kit floorplan.png pixels -> Figma plan, least-squares fit on the 15 stops, per floor. */
const TO_PLAN: Record<number, [number, number, number, number, number, number]> = {
  1: [0.7938, 0.0016, 0.0676, -0.0052, 0.8001, -16.9824],
  2: [0.7963, 0, 0.0094, -0.0021, 0.7979, -16.384],
};
const toPlan = (p: Pt) => {
  const [a, b, c, d, e, f] = TO_PLAN[p.floor] ?? TO_PLAN[1];
  return { x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f, floor: p.floor };
};

const MAP = mapData as MapData;
const NAV = new NavGrid(MAP);
const STOPS = new Map(MAP.stops.map((s) => [s.id, s]));

/**
 * Map & Sim's floor plan photo (floorplan.png, same aspect) scaled into the 872 x 474 box. Pins and
 * routes use map-sim's own coordinates, so they sit exactly on the pins printed in the photo.
 */
const PHOTO = { sx: W / 1095, ox: 0, sy: H / 595, oy: 0 };
const toPhoto = (p: Pt) => ({ x: PHOTO.sx * p.x + PHOTO.ox, y: PHOTO.sy * p.y + PHOTO.oy, floor: p.floor });
const PHOTO_PINS = Object.fromEntries(MAP.stops.map((s) => [s.id, toPhoto(s)])) as Record<LocationId, Pt>;

/** Which floor plan the map draws on: Map & Sim's photo, or the Figma cartoon plan. */
export type MapBase = "photo" | "cartoon";

/** Route colours per base: the dark photo needs stronger lines than the cream cartoon. */
const ROUTE = {
  cartoon: { ok: { stroke: "#3F8E3E", strokeOpacity: 0.3 }, next: { stroke: "#1F3A24", strokeOpacity: 0.3 } },
  photo: { ok: { stroke: "#7BD06F", strokeOpacity: 0.9 }, next: { stroke: "#FFFDF5", strokeOpacity: 0.75 } },
} as const;

/** Body length of SPOT on the plan, in plan px. */
const SPOT_LEN = 26;

/**
 * The walk between two stops as plan-space polylines (two when it takes the stairs).
 * Each end is nudged onto its Figma pin and the nudge fades out along the leg.
 */
function walkLegs(from: LocationId, to: LocationId, base: MapBase): Pt[][] {
  const a = STOPS.get(from);
  const b = STOPS.get(to);
  const pa = PINS[from];
  const pb = PINS[to];
  if (!a || !b || !pa || !pb || from === to) return [];
  if (base === "photo") return NAV.route({ x: a.x, y: a.y, floor: a.floor }, { x: b.x, y: b.y, floor: b.floor }).legs.map((l) => l.map(toPhoto));
  const legs = NAV.route({ x: a.x, y: a.y, floor: a.floor }, { x: b.x, y: b.y, floor: b.floor }).legs.map((l) => l.map(toPlan));
  const offA = (() => { const q = toPlan({ x: a.x, y: a.y, floor: a.floor }); return { x: pa.x - q.x, y: pa.y - q.y }; })();
  const offB = (() => { const q = toPlan({ x: b.x, y: b.y, floor: b.floor }); return { x: pb.x - q.x, y: pb.y - q.y }; })();
  return legs.map((leg, i) => {
    const start = i === 0 ? offA : { x: 0, y: 0 };
    const end = i === legs.length - 1 ? offB : { x: 0, y: 0 };
    const total = polylineLength(leg) || 1;
    let acc = 0;
    return leg.map((p, j) => {
      if (j > 0) acc += Math.hypot(p.x - leg[j - 1].x, p.y - leg[j - 1].y);
      const k = acc / total;
      return { x: p.x + start.x * (1 - k) + end.x * k, y: p.y + start.y * (1 - k) + end.y * k, floor: p.floor };
    });
  });
}

/** Split a walk at `progress` (0..1 of its length): the walked part, the rest, and where SPOT is. */
function splitWalk(legs: Pt[][], progress: number) {
  const lengths = legs.map(polylineLength);
  let d = progress * lengths.reduce((s, l) => s + l, 0);
  const done: Pt[][] = [];
  const rest: Pt[][] = [];
  let at: Pt | null = null;
  let heading = 0;
  legs.forEach((leg, i) => {
    if (at) return void rest.push(leg);
    if (d > lengths[i] && i < legs.length - 1) {
      done.push(leg);
      d -= lengths[i];
      return;
    }
    const dd = Math.min(d, lengths[i]);
    at = pointAlong(leg, dd);
    heading = headingAlong(leg, dd);
    let acc = 0;
    const walked: Pt[] = [leg[0]];
    const ahead: Pt[] = [at];
    for (let j = 1; j < leg.length; j++) {
      acc += Math.hypot(leg[j].x - leg[j - 1].x, leg[j].y - leg[j - 1].y);
      (acc < dd ? walked : ahead).push(leg[j]);
    }
    walked.push(at);
    done.push(walked);
    rest.push(ahead);
  });
  return { done, rest, at, heading };
}

const pathD = (legs: Pt[][]) =>
  legs.map((l) => l.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")).join(" ");

export type MapLayers = "route" | "findings" | "both";

type Props = FacilityMapLiveProps & {
  /** Proposed addition for Map & Sim: the Route / Findings / Both toggle in the map card header. */
  layers?: MapLayers;
  /** Proposed addition: text for each alert badge ("High"), since alertLocationIds carries no severity. */
  alertLabels?: Partial<Record<LocationId, string>>;
  /** Floor plan to draw on (default: Map & Sim's photo). */
  base?: MapBase;
};

const showRouteFor = (layers: MapLayers) => layers !== "findings";

type Leg = { from: LocationId; to: LocationId; kind: "ok" | "failed" | "next" };

/** Where SPOT is at mission-clock `t`, given the events so far (re-derived, so seeking just works). */
function spotAt(plan: Action[], doneIds: Set<string>, t: number, startTs: number) {
  const next = plan.findIndex((a) => !doneIds.has(a.action_id));
  if (next === -1) {
    const last = plan[plan.length - 1];
    return { index: plan.length, from: last?.location_id ?? START_LOCATION, to: last?.location_id ?? START_LOCATION, progress: 1, inspecting: false };
  }
  const a = plan[next];
  const prev = plan[next - 1];
  const leave = prev ? msOf(prev.timestamp) : startTs;
  const arrive = Math.max(leave, msOf(a.timestamp) - (a.duration_sec ?? 0) * 1000);
  const progress = t >= arrive ? 1 : Math.max(0, (t - leave) / Math.max(1, arrive - leave));
  return { index: next, from: prev?.location_id ?? START_LOCATION, to: a.location_id, progress, inspecting: t >= arrive };
}

export function FacilityMap({
  events,
  plan = [],
  speed,
  playing,
  alertLocationIds = [],
  alertLabels = {},
  selectedLocationId,
  onSelectLocation,
  onHoverLocation,
  onSpotStatus,
  layers = "both",
  base = "photo",
  className = "",
}: Props) {
  const sorted = useMemo(() => [...plan].sort((a, b) => a.sequence - b.sequence), [plan]);
  const latest = events[events.length - 1];
  const latestTs = latest ? msOf(latest.timestamp) : sorted.length ? msOf(sorted[0].timestamp) : 0;
  const startTs = events[0]?.event_type === "MISSION_STARTED" ? msOf(events[0].timestamp) : latestTs;

  // The map's own clock (contract: advance from the latest event at `speed`, never past the next action).
  const [t, setT] = useState(latestTs);
  const anchor = useRef({ ts: latestTs, real: 0 });
  useEffect(() => {
    anchor.current = { ts: latestTs, real: performance.now() };
    setT(latestTs);
  }, [latestTs]);
  useEffect(() => {
    if (!playing) return;
    anchor.current = { ts: t, real: performance.now() };
    let frame = 0;
    const tick = (now: number) => {
      setT(anchor.current.ts + (now - anchor.current.real) * speed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Re-anchor only when play state or speed changes; `t` is read once on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const results = useMemo(() => {
    const r = new Map<string, boolean>();
    for (const e of events) {
      if (e.event_type === "ACTION_COMPLETED") r.set(e.details.action_id, true);
      if (e.event_type === "ACTION_FAILED") r.set(e.details.action_id, false);
    }
    return r;
  }, [events]);

  const ended = latest?.event_type === "MISSION_COMPLETED";
  const nextTs = sorted.find((a) => !results.has(a.action_id));
  const clamped = Math.min(t, nextTs ? msOf(nextTs.timestamp) : latestTs);
  const spot = spotAt(sorted, new Set(results.keys()), clamped, startTs);
  const walks = useMemo(
    () => sorted.map((act, i) => walkLegs(i === 0 ? START_LOCATION : sorted[i - 1].location_id, act.location_id, base)),
    [sorted, base],
  );
  const current = walks[spot.index] ?? [];
  const split = splitWalk(current, spot.progress);
  const pinsXY: Record<LocationId, { x: number; y: number }> = base === "photo" ? PHOTO_PINS : PINS;
  const home = pinsXY[spot.to] ?? pinsXY[START_LOCATION];
  const spotXY: { x: number; y: number } = split.at ?? home;
  const prevFailed = spot.index > 0 && results.get(sorted[spot.index - 1]?.action_id) === false;
  const spotMode: SpotMode = ended ? "idle" : spot.inspecting ? "inspect" : prevFailed && spot.progress < 0.12 ? "fail" : "walk";

  // Tell the page what SPOT is doing whenever it changes.
  const mode: SpotStatus["mode"] = !events.length ? "idle" : ended ? "done" : spot.inspecting ? "inspecting" : "walking";
  const statusKey = `${mode}:${spot.to}`;
  const lastStatus = useRef("");
  useEffect(() => {
    if (!onSpotStatus || lastStatus.current === statusKey) return;
    lastStatus.current = statusKey;
    let battery: number | null = null;
    for (const e of events) if (e.event_type === "ACTION_STARTED" || e.event_type === "MISSION_STARTED") battery = e.details.battery_pct;
    onSpotStatus({ mode, location_id: spot.to, action_id: sorted[spot.index]?.action_id ?? null, battery_pct: battery });
  }, [statusKey, onSpotStatus, mode, spot.to, spot.index, sorted, events]);

  // SPOT itself: Map & Sim's animated robot, drawn on a canvas over the plan every frame.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animator = useRef(new SpotAnimator(0));
  const lastFrame = useRef(0);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  // Redraw when the map is resized while paused (playing redraws every frame anyway).
  const [, setResized] = useState(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setResized((n) => n + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  const visible = showRouteFor(layers) && events.length > 0;
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scale = canvas.clientWidth / W;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvas.clientWidth * dpr)) {
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!visible) return;
    const now = performance.now();
    const dt = lastFrame.current ? Math.min(0.1, (now - lastFrame.current) / 1000) : 0;
    lastFrame.current = now;
    const an = animator.current;
    const prev = lastPos.current;
    // A seek teleports SPOT: no leg swing or slow turn for the jump.
    const jumped = !prev || Math.hypot(spotXY.x - prev.x, spotXY.y - prev.y) > SPOT_LEN * 3;
    lastPos.current = { x: spotXY.x, y: spotXY.y };
    const moving = spotMode === "walk" || spotMode === "fail";
    if (jumped) an.reset(spotXY.x, spotXY.y, split.heading);
    else an.update(spotXY.x, spotXY.y, dt, SPOT_LEN, moving && split.at ? split.heading : undefined);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    drawSpot(ctx, { x: spotXY.x, y: spotXY.y, heading: an.heading, gait: an.gait, walking: an.walking, mode: spotMode, size: SPOT_LEN, t: now / 1000 });
  });

  // Legs: start -> stop 1 -> stop 2 ... coloured by the result at the stop they lead to.
  const legs: Leg[] = sorted.map((act, i) => {
    const r = results.get(act.action_id);
    return { from: i === 0 ? START_LOCATION : sorted[i - 1].location_id, to: act.location_id, kind: r === undefined ? "next" : r ? "ok" : "failed" };
  });

  // Pin state: failed beats succeeded beats still-on-the-route beats not-in-this-mission.
  const pinState = (id: LocationId) => {
    const visits = sorted.filter((x) => x.location_id === id);
    if (!visits.length) return "idle" as const;
    if (visits.some((x) => results.get(x.action_id) === false)) return "failed" as const;
    if (visits.some((x) => results.get(x.action_id) === true)) return "ok" as const;
    return "next" as const;
  };

  const showRoute = showRouteFor(layers);
  const showFindings = layers !== "route";

  return (
    <div className={`relative ${className}`}>
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label="Facility map, floors 1 and 2">
      {base === "photo" ? (
        <image href={floorplan.src} x={PHOTO.ox} y={PHOTO.oy} width={MAP.width * PHOTO.sx} height={MAP.height * PHOTO.sy} preserveAspectRatio="none" />
      ) : (
        <>
          <image href="/figma/floor-plan-cartoon.svg" x={0} y={0} width={W} height={H} />
          <text x={36} y={15} className="fill-fg font-display text-[16px] font-semibold">Floor 1</text>
          <text x={622} y={15} className="fill-fg font-display text-[16px] font-semibold">Floor 2</text>
        </>
      )}

      {showRoute &&
        legs.map((leg, i) => {
          const walk = walks[i];
          if (!walk?.length) return null;
          const line = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
          if (i === spot.index && !ended) {
            // Current leg: walked part in green, the rest dashed SPOT yellow.
            return (
              <g key={i}>
                <path d={pathD(split.done)} {...ROUTE[base].ok} strokeWidth={4} {...line} />
                <path d={pathD(split.rest)} stroke="#E0A800" strokeWidth={4} strokeDasharray="6.37 5.57" {...line} />
              </g>
            );
          }
          if (leg.kind === "next")
            return <path key={i} d={pathD(walk)} {...ROUTE[base].next} strokeWidth={2.4} strokeDasharray="0.8 7.17" {...line} />;
          return leg.kind === "failed" ? (
            <path key={i} d={pathD(walk)} stroke="#B8263F" strokeWidth={4} {...line} />
          ) : (
            <path key={i} d={pathD(walk)} {...ROUTE[base].ok} strokeWidth={4} {...line} />
          );
        })}

      {Object.entries(PINS).map(([id, pin]) => {
        const state = pinState(id);
        const size = state === "ok" ? 30 : state === "failed" ? 24 : state === "next" ? 22 : 18;
        const src = { ok: "/figma/pin-success.svg", failed: "/figma/pin-failed.svg", next: "/figma/glyph-next.svg", idle: "/figma/glyph-idle.svg" }[state];
        const seqs = sorted.filter((x) => x.location_id === id).map((x) => x.sequence);
        const label = seqs.length ? `${id} · ${seqs.join(", ")}` : id;
        const name = LOCATIONS[id]?.location_name ?? id;
        const stateText = { ok: "step succeeded", failed: "step failed", next: "on the route", idle: "not in this mission" }[state];
        const alert = showFindings && alertLocationIds.includes(id);
        const interactive = !!onSelectLocation;
        const photo = base === "photo";
        const tip = pinsXY[id] ?? pin;
        // On the photo, the printed pin and label stay; our state glyph sits at the pin's top right.
        const glyph = photo
          ? { x: tip.x + 13, y: tip.y - 27, size: state === "ok" ? 24 : state === "failed" ? 22 : 0 }
          : { x: pin.x, y: pin.y, size };
        const ring = photo ? { x: tip.x, y: tip.y - 15, r: 14 } : { x: pin.x, y: pin.y, r: size / 2 + 6 };
        const alertY = photo ? tip.y + 20 : Math.max(pin.y + size / 2, pin.y + pin.ly + 16) + 9;
        return (
          <g
            key={id}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${id} ${name}, ${stateText}${alert ? ", needs review" : ""}`}
            onClick={() => onSelectLocation?.(id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectLocation?.(id);
              }
            }}
            onMouseEnter={() => onHoverLocation?.(id)}
            onMouseLeave={() => onHoverLocation?.(null)}
            className={interactive ? "cursor-pointer outline-none [&:focus-visible>circle]:stroke-line-strong" : undefined}
          >
            <circle cx={ring.x} cy={ring.y} r={ring.r} fill="transparent" stroke={selectedLocationId === id ? (photo ? "#FFFDF5" : "#1F3A24") : "transparent"} strokeWidth={2} />
            {glyph.size > 0 && <image href={src} x={glyph.x - glyph.size / 2} y={glyph.y - glyph.size / 2} width={glyph.size} height={glyph.size} />}
            {!photo && (
              <text x={pin.x + pin.lx} y={pin.y + pin.ly + 12} className={`font-mono text-[12px] ${state === "idle" ? "fill-fg-subtle" : "fill-fg"}`}>
                {label}
              </text>
            )}
            {alert && (
              <g transform={`translate(${tip.x - (photo ? 30 : 7)} ${alertY})`}>
                {photo && <rect x={-4} y={-2} width={68} height={20} rx={6} fill="#FFFDF5" stroke="#1F3A24" strokeWidth={1.5} />}
                <image href="/figma/icon-alert-triangle-high.svg" width={16} height={16} />
                <text x={20} y={12.5} className="fill-high font-sans text-[13px] font-medium">
                  {alertLabels[id] ?? "Review"}
                </text>
              </g>
            )}
          </g>
        );
      })}

    </svg>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        role="img"
        aria-label={events.length ? `SPOT ${spotMode === "inspect" ? "inspecting" : spotMode === "walk" ? "walking" : "stopped"} near ${spot.to}` : "SPOT not started"}
      />
    </div>
  );
}
