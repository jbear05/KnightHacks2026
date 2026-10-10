// What-if scenarios on the Live Mission replay, from Map & Sim's engine (map-sim/src/sim, IliasCoder):
// a heat wave (air temperature, SPOT and charger limits, equipment running hotter, shorter component
// life) and an obstacle in front of the dock that SPOT has to walk around, plus component-life alerts
// (always on). Only map-sim's SIMULATED alerts are shown: what comes from the data is already on screen.
import mapData from "@/map-sim/data/map.json";
import missionsData from "@/map-sim/data/missions.json";
import {
  MissionRun,
  NavGrid,
  ambientC,
  componentHealth,
  distToRect,
  dockObstacleAlert,
  obstacleOnApproach,
  pointAlong,
  polylineLength,
} from "@/map-sim/src/sim/index.ts";
import type { ComponentHealth, FeedAlert, MapData, MissionData, Pt, Rect, Stop } from "@/map-sim/src/sim/index.ts";
import { START_LOCATION, type FeedRow, type LiveState, type QueueItem } from "@/lib/replay";

export interface Scenario {
  /** Heat wave strength in °C on top of normal indoor air; 0 = off. */
  heatC: number;
  /** An obstacle is left in front of the dock (WP15). */
  obstacle: boolean;
}

export const NO_SCENARIO: Scenario = { heatC: 0, obstacle: false };
/** map-sim's sandbox default. */
export const DEFAULT_HEAT_C = 16;
export const MAX_HEAT_C = 30;
/** WP15 Inspection Dock is SPOT's charging dock (map-sim's assumption; the data doesn't say). */
export const DOCK_ID = "WP15";

const MAP = mapData as MapData;
const DATA = missionsData as MissionData;
const NAV = new NavGrid(MAP);
const STOPS = Object.fromEntries(MAP.stops.map((s) => [s.id, s])) as Record<string, Stop>;
const DOCK = STOPS[DOCK_ID];
/** SPOT notices the obstacle this close, in floor-plan px (same as map-sim's sandbox). */
const SEE_PX = 25;

let healthCache: Map<string, ComponentHealth> | null = null;
const health = () => (healthCache ??= componentHealth(DATA));

const at = (s: Stop): Pt => ({ x: s.x, y: s.y, floor: s.floor });

/** Where SPOT walks to step i from: the last stop it actually went to (skipped stops don't count). */
export function fromStop(plan: { action_id: string; location_id: string }[], i: number, skipped: ReadonlySet<string>): string {
  for (let k = i - 1; k >= 0; k--) if (!skipped.has(plan[k].action_id)) return plan[k].location_id;
  return START_LOCATION;
}

export interface DockWalk {
  /** The walk SPOT actually takes, in floorplan.png px: up to where it sees the obstacle, then the detour. */
  legs: Pt[][];
  /** The obstacle, in floorplan.png px. */
  rect: Rect;
  /** How far through the walk (0..1 of its length) SPOT sees the obstacle and re-plans. */
  seeAt: number;
  /** false: no way around, SPOT stops where it saw it. */
  rerouted: boolean;
}

const dockWalks = new Map<string, DockWalk | null>();

/** The walk from a stop to the dock with the obstacle in front of it, as map-sim's sandbox plays it. */
export function dockWalk(fromId: string): DockWalk | null {
  if (dockWalks.has(fromId)) return dockWalks.get(fromId)!;
  const from = STOPS[fromId];
  let walk: DockWalk | null = null;
  if (from && fromId !== DOCK_ID) {
    const legs = NAV.route(at(from), at(DOCK)).legs;
    const last = legs[legs.length - 1];
    const rect = obstacleOnApproach(last);
    const lastLen = polylineLength(last);
    let d = 0;
    while (d < lastLen && distToRect(pointAlong(last, d).x, pointAlong(last, d).y, rect) > SEE_PX) d += 1;
    const seen = pointAlong(last, d);
    const walked: Pt[] = [];
    let acc = 0;
    last.forEach((p, i) => {
      if (i > 0) acc += Math.hypot(p.x - last[i - 1].x, p.y - last[i - 1].y);
      if (acc < d) walked.push(p);
    });
    walked.push(seen);
    let detour: Pt[][] = [];
    try {
      detour = NAV.withBlocked([rect]).route(seen, at(DOCK)).legs;
    } catch {
      // no way around: SPOT stays where it saw the obstacle
    }
    const before = [...legs.slice(0, -1), walked];
    const beforeLen = before.reduce((s, l) => s + polylineLength(l), 0);
    const total = beforeLen + detour.reduce((s, l) => s + polylineLength(l), 0);
    walk = { legs: [...before, ...detour], rect, seeAt: total ? beforeLen / total : 1, rerouted: detour.length > 0 };
  }
  dockWalks.set(fromId, walk);
  return walk;
}

export interface ScenarioState {
  /** Simulated alerts raised so far, newest first (map-sim's AlertFeed order). */
  alerts: FeedAlert[];
  /** Steps SPOT skips because the stop is above its 45°C limit. */
  skipped: Set<string>;
  /** Simulated air temperature where SPOT is headed, °C; null when the heat wave is off. */
  airC: number | null;
}

/**
 * Replays map-sim's MissionRun up to the replay's current moment.
 * @param finished action ids whose result has played
 * @param current the step SPOT is on (walking or inspecting), with how far it has walked
 * @param now replay clock, plant time ("02:24:00"): alerts raised while heading to the current step
 *            carry that step's timestamp in map-sim, so they are stamped with now instead
 */
export function scenarioState(
  missionId: string,
  scenario: Scenario,
  finished: Set<string>,
  current: { action_id: string; location_id: string; progress: number; inspecting: boolean } | null,
  ended: boolean,
  now?: string,
): ScenarioState {
  const empty: ScenarioState = { alerts: [], skipped: new Set(), airC: null };
  if (!DOCK) return empty;
  const run = new MissionRun(DATA, health(), STOPS, DOCK, missionId);
  const skipped = new Set<string>();
  run.actions.forEach((act, i) => {
    const isCurrent = current?.action_id === act.action_id;
    if (!finished.has(act.action_id) && !isCurrent) return;
    const { skip } = run.beginAction(i, scenario.heatC);
    if (skip) skipped.add(act.action_id);
    if (scenario.obstacle && act.location_id === DOCK_ID) {
      const walk = skip ? null : dockWalk(fromStop(run.actions, i, skipped));
      const seen = finished.has(act.action_id) || (isCurrent && (current.inspecting || current.progress >= (walk?.seeAt ?? 1)));
      if (walk && seen) run.raise(dockObstacleAlert(DOCK, walk.rerouted));
    }
    if (finished.has(act.action_id) && !skip) run.completeAction(i, scenario.heatC);
  });
  if (ended) run.finish();
  const here = STOPS[current?.location_id ?? ""] ?? null;
  return {
    alerts: run.feed.list.filter((a) => a.simulated).map((a) => (now && a.at > now ? { ...a, at: now } : a)),
    skipped,
    airC: scenario.heatC > 0 && here ? Math.round(ambientC(here, run.progress, scenario.heatC)) : null,
  };
}

/** `?heat=16&obstacle=1` on /live, so a demo can open with a scenario on. */
export function scenarioFromParams(heat?: string, obstacle?: string): Scenario {
  const h = Number(heat);
  return {
    heatC: Number.isFinite(h) ? Math.min(MAX_HEAT_C, Math.max(0, Math.round(h))) : 0,
    obstacle: obstacle === "1" || obstacle === "true",
  };
}

/** Adds the simulated alerts to the rail: critical ones top the queue, warnings go after the data's items. */
export function withScenario(live: LiveState, state: ScenarioState): LiveState {
  if (!state.alerts.length) return live;
  // A skipped step never happened: its result, feed rows and failed-step item go.
  const sk = state.skipped;
  const kept = live.results.filter((r) => !sk.has(r.action.action_id));
  const ofSkipped = (key: string) => [...sk].some((id) => key.startsWith(`${id}-`));
  const items = state.alerts
    .filter((a) => a.level !== "info")
    .map((a): QueueItem => ({ kind: "sim", key: `sim-${a.id}`, level: a.level as "warning" | "critical", title: a.title, detail: a.detail, time: a.at }));
  const rows = state.alerts.map((a): FeedRow => ({ key: `sim-${a.id}`, time: a.at, glyph: "sim", text: a.title, detail: "· what-if" }));
  const queue = live.queue.filter((q) => !(q.kind === "failed" && sk.has(q.action.action_id)));
  return {
    ...live,
    results: kept,
    succeeded: kept.filter((r) => r.ok).length,
    failed: kept.filter((r) => !r.ok).length,
    queue: [...items.filter((i) => i.kind === "sim" && i.level === "critical"), ...queue, ...items.filter((i) => i.kind === "sim" && i.level === "warning")],
    // Newest first; on a tie the simulated row goes above the data's row for that step.
    feed: [...rows, ...live.feed.filter((r) => !ofSkipped(r.key))].map((r, i) => ({ r, i })).sort((a, b) => b.r.time.localeCompare(a.r.time) || a.i - b.i).map(({ r }) => r),
  };
}
