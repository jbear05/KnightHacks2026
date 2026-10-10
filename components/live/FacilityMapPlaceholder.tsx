"use client";

// STAND-IN for Map & Sim's <FacilityMap mode="live" /> until IliasCoder's map-sim module lands
// (PR #6 was closed without merging). It takes the same props as contracts/facility-map-props.ts,
// so swapping it for the real map is a one-line import change in LiveMission.tsx.
// What it does NOT do (Map & Sim's job): A* paths around walls, the floor plan photo, floor
// switching. SPOT walks a straight line between the pins drawn in the Figma mock.
import { useEffect, useMemo, useRef, useState } from "react";
import type { FacilityMapLiveProps, LocationId, SpotStatus } from "@/contracts/facility-map-props";
import { LOCATIONS } from "@/lib/reference";
import { msOf, START_LOCATION } from "@/lib/replay";
import type { Action } from "@/lib/types";

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

export type MapLayers = "route" | "findings" | "both";

type Props = FacilityMapLiveProps & {
  /** Proposed addition for Map & Sim: the Route / Findings / Both toggle in the map card header. */
  layers?: MapLayers;
  /** Proposed addition: text for each alert badge ("High"), since alertLocationIds carries no severity. */
  alertLabels?: Partial<Record<LocationId, string>>;
};

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

export function FacilityMapPlaceholder({
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
  const a = PINS[spot.from] ?? PINS[START_LOCATION];
  const b = PINS[spot.to] ?? a;
  const spotXY = { x: a.x + (b.x - a.x) * spot.progress, y: a.y + (b.y - a.y) * spot.progress };

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

  const showRoute = layers !== "findings";
  const showFindings = layers !== "route";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block h-auto w-full ${className}`} role="group" aria-label="Facility map, floors 1 and 2">
      <image href="/figma/floor-plan-cartoon.svg" x={0} y={0} width={W} height={H} />
      <text x={36} y={15} className="fill-fg font-display text-[16px] font-semibold">Floor 1</text>
      <text x={622} y={15} className="fill-fg font-display text-[16px] font-semibold">Floor 2</text>

      {showRoute &&
        legs.map((leg, i) => {
          const p = PINS[leg.from];
          const q = PINS[leg.to];
          if (!p || !q || leg.from === leg.to) return null;
          if (i === spot.index && !ended) {
            // Current leg: walked part in green, the rest dashed SPOT yellow.
            return (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={spotXY.x} y2={spotXY.y} stroke="#3F8E3E" strokeOpacity={0.3} strokeWidth={4} strokeLinecap="round" />
                <line x1={spotXY.x} y1={spotXY.y} x2={q.x} y2={q.y} stroke="#E0A800" strokeWidth={4} strokeLinecap="round" strokeDasharray="6.37 5.57" />
              </g>
            );
          }
          if (leg.kind === "next")
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#1F3A24" strokeOpacity={0.3} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="0.8 7.17" />;
          return leg.kind === "failed" ? (
            <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#B8263F" strokeWidth={4} strokeLinecap="round" />
          ) : (
            <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#3F8E3E" strokeOpacity={0.3} strokeWidth={4} strokeLinecap="round" />
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
            <circle cx={pin.x} cy={pin.y} r={size / 2 + 6} fill="transparent" stroke={selectedLocationId === id ? "#1F3A24" : "transparent"} strokeWidth={2} />
            <image href={src} x={pin.x - size / 2} y={pin.y - size / 2} width={size} height={size} />
            <text x={pin.x + pin.lx} y={pin.y + pin.ly + 12} className={`font-mono text-[12px] ${state === "idle" ? "fill-fg-subtle" : "fill-fg"}`}>
              {label}
            </text>
            {alert && (
              <g transform={`translate(${pin.x - 7} ${Math.max(pin.y + size / 2, pin.y + pin.ly + 16) + 9})`}>
                <image href="/figma/icon-alert-triangle-high.svg" width={16} height={16} />
                <text x={20} y={12.5} className="fill-high font-sans text-[13px] font-medium">
                  {alertLabels[id] ?? "Review"}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {showRoute && events.length > 0 && (
        <image href="/figma/glyph-spot.svg" x={spotXY.x - 17} y={spotXY.y - 17} width={34} height={34} aria-label="SPOT" />
      )}
    </svg>
  );
}
