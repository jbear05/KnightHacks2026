// What-if scenarios on the Live Mission replay, from Map & Sim's engine (map-sim/src/sim, IliasCoder):
// a heat wave (air temperature, SPOT and charger limits, equipment running hotter, shorter component
// life) and an obstacle in front of the dock that SPOT has to walk around, plus component-life alerts
// (always on). The cold snap is the heat wave's mirror, built here on map-sim's air model and the
// SPOT user guide's lower limits (map-sim's weather check uses the same -20°C). Only map-sim's SIMULATED alerts are shown: what comes from the data is already on screen.
import mapData from "@/map-sim/data/map.json";
import missionsData from "@/map-sim/data/missions.json";
import {
  MissionRun,
  LIFE,
  NavGrid,
  ambientC,
  componentHealth,
  componentsAt,
  distToRect,
  dockObstacleAlert,
  obstacleOnApproach,
  pointAlong,
  polylineLength,
} from "@/map-sim/src/sim/index.ts";
import type { Alert, ComponentHealth, FeedAlert, MapData, MissionData, Pt, Rect, Stop } from "@/map-sim/src/sim/index.ts";
import { START_LOCATION, type FeedRow, type LiveState, type QueueItem } from "@/lib/replay";

export interface Scenario {
  /** Heat wave strength in °C on top of normal indoor air; 0 = off. */
  heatC: number;
  /** Cold snap strength in °C below normal indoor air; 0 or missing = off. Ignored while the heat wave is on. */
  coldC?: number;
  /** An obstacle is left in front of the dock (WP15). */
  obstacle: boolean;
}

export const NO_SCENARIO: Scenario = { heatC: 0, coldC: 0, obstacle: false };
/** map-sim's sandbox default. */
export const DEFAULT_HEAT_C = 16;
export const MAX_HEAT_C = 30;
/** Enough for the corridors to drop past SPOT's -20°C limit in the second half of a mission. */
export const DEFAULT_COLD_C = 55;
export const MAX_COLD_C = 70;

/** SPOT user guide: SPOT operates from -20°C, its charger from 0°C (map-sim's LIMITS has the upper ends). */
export const COLD = { spotMinC: -20, chargerMinC: 0 };

/**
 * Cold snap (simulated): the heating fails in a winter storm. Same shape as map-sim's heat wave
 * (heatWaveExtraC): the air drops by half the strength at the start and the full strength by the end,
 * from map-sim's indoor air (machinery rooms still run warmer than corridors).
 */
export function coldAmbientC(stop: Pick<Stop, "zone" | "floor">, progress: number, coldC: number): number {
  return ambientC(stop, progress, 0) - Math.max(0, coldC) * (0.5 + 0.5 * progress);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Cold check before SPOT walks to a stop, like map-sim's heatAlert: critical = skip the stop. */
export function coldAlert(stop: Stop, progress: number, coldC: number, actionId: string | null = null): Alert | null {
  if (coldC <= 0) return null;
  const c = round1(coldAmbientC(stop, progress, coldC));
  const base = { simulated: true, location_id: stop.id, action_id: actionId };
  if (c < COLD.spotMinC) return {
    ...base, id: `cold-stop-${stop.id}-${actionId}`, level: "critical", title: "Too cold for SPOT: stop skipped",
    detail: `${stop.name} is at ${c}°C, below SPOT's ${COLD.spotMinC}°C operating limit (SPOT user guide). SPOT skips this stop.`,
  };
  if (c < COLD.spotMinC + 5) return {
    ...base, id: `cold-warn-${stop.id}-${actionId}`, level: "warning", title: "It's getting cold in here",
    detail: `${stop.name} is at ${c}°C. SPOT's lower limit is ${COLD.spotMinC}°C (SPOT user guide).`,
  };
  return null;
}

/** Fires once when the dock is too cold for SPOT's charger. */
export function dockColdAlert(dock: Stop, progress: number, coldC: number): Alert | null {
  if (coldC <= 0) return null;
  const c = round1(coldAmbientC(dock, progress, coldC));
  if (c >= COLD.chargerMinC) return null;
  return {
    id: `cold-dock-${dock.id}`, level: "warning", simulated: true, location_id: dock.id, action_id: null,
    title: "Dock too cold to charge",
    detail: `${dock.name} is at ${c}°C, below the charger's ${COLD.chargerMinC}°C limit (SPOT user guide). SPOT can't recharge there until it warms up.`,
  };
}
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

export interface StopComponents {
  stopName: string;
  /** Components based at the stop (where SPOT inspects them most), weakest first. */
  components: ComponentHealth[];
  /** Components based elsewhere that SPOT also checks here now and then. */
  visiting: ComponentHealth[];
}

/** map-sim's component health at a stop, for the card that opens when a pin is clicked. */
export function stopComponents(stopId: string): StopComponents | null {
  const stop = STOPS[stopId];
  if (!stop) return null;
  const visiting = [...health().values()].filter((h) => h.stops[0] !== stopId && h.stops.includes(stopId));
  return { stopName: stop.name, components: componentsAt(health(), stopId), visiting };
}

/** map-sim's alert bands for simulated life left. */
export const lifeLevel = (months: number) => (months <= LIFE.criticalMonths ? "critical" : months <= LIFE.warnMonths ? "warning" : "ok");

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
  /** Steps SPOT skips because the stop is above its 45°C limit (heat wave) or below -20°C (cold snap). */
  skipped: Set<string>;
  /** Why steps are skipped: whichever temperature what-if is on. */
  skipReason: "hot" | "cold";
  /** Simulated air temperature where SPOT is headed, °C; null when neither temperature what-if is on. */
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
  const heatC = scenario.heatC;
  const coldC = heatC > 0 ? 0 : (scenario.coldC ?? 0);
  const skipReason = coldC > 0 ? "cold" : "hot";
  const empty: ScenarioState = { alerts: [], skipped: new Set(), skipReason, airC: null };
  if (!DOCK) return empty;
  const run = new MissionRun(DATA, health(), STOPS, DOCK, missionId);
  const skipped = new Set<string>();
  run.actions.forEach((act, i) => {
    const isCurrent = current?.action_id === act.action_id;
    if (!finished.has(act.action_id) && !isCurrent) return;
    const { skip: hot } = run.beginAction(i, heatC);
    let skip = hot;
    if (coldC > 0) {
      const cold = coldAlert(STOPS[act.location_id], run.progress, coldC, act.action_id);
      run.raise(dockColdAlert(DOCK, run.progress, coldC));
      run.raise(cold);
      skip ||= cold?.level === "critical";
    }
    if (skip) skipped.add(act.action_id);
    if (scenario.obstacle && act.location_id === DOCK_ID) {
      const walk = skip ? null : dockWalk(fromStop(run.actions, i, skipped));
      const seen = finished.has(act.action_id) || (isCurrent && (current.inspecting || current.progress >= (walk?.seeAt ?? 1)));
      if (walk && seen) run.raise(dockObstacleAlert(DOCK, walk.rerouted));
    }
    if (finished.has(act.action_id) && !skip) run.completeAction(i, heatC);
  });
  if (ended) run.finish();
  const here = STOPS[current?.location_id ?? ""] ?? null;
  return {
    alerts: run.feed.list.filter((a) => a.simulated).map((a) => (now && a.at > now ? { ...a, at: now } : a)),
    skipped,
    skipReason,
    airC: !here
      ? null
      : heatC > 0
        ? Math.round(ambientC(here, run.progress, heatC))
        : coldC > 0
          ? Math.round(coldAmbientC(here, run.progress, coldC))
          : null,
  };
}

const clampParam = (v: string | undefined, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0;
};

/** `?heat=16&obstacle=1` or `?cold=55` on /live, so a demo can open with a scenario on. Heat wins over cold. */
export function scenarioFromParams(heat?: string, obstacle?: string, cold?: string): Scenario {
  const heatC = clampParam(heat, MAX_HEAT_C);
  return {
    heatC,
    coldC: heatC > 0 ? 0 : clampParam(cold, MAX_COLD_C),
    obstacle: obstacle === "1" || obstacle === "true",
  };
}

/** Adds the simulated alerts to the rail: critical ones top the queue, warnings go after the data's items. */
export function withScenario(live: LiveState, state: ScenarioState): LiveState {
  if (!state.alerts.length) return live;
  // A skipped step never happened: remove its result, findings, queue items and feed rows.
  const sk = state.skipped;
  const kept = live.results.filter((r) => !sk.has(r.action.action_id));
  const skippedFindingKeys = new Set(live.problems.filter((p) => sk.has(p.action_id)).map((p) => `P${p.anomaly_id}`));
  const ofSkipped = (key: string) => skippedFindingKeys.has(key) || [...sk].some((id) => key.startsWith(`${id}-`));
  const current = live.current
    ? {
        ...live.current,
        fromLocationId: kept[kept.length - 1]?.action.location_id ?? START_LOCATION,
        ...(sk.has(live.current.action.action_id) ? { phase: "skipping" as const, progress: 0, skipReason: state.skipReason } : {}),
      }
    : null;
  const items = state.alerts
    .filter((a) => a.level !== "info")
    .map((a): QueueItem => ({ kind: "sim", key: `sim-${a.id}`, level: a.level as "warning" | "critical", title: a.title, detail: a.detail, time: a.at }));
  const rows = state.alerts.map((a): FeedRow => ({ key: `sim-${a.id}`, time: a.at, glyph: "sim", text: a.title, detail: "· what-if" }));
  const queue = live.queue.filter((q) =>
    q.kind === "problem" ? !sk.has(q.problem.action_id) : q.kind !== "failed" || !sk.has(q.action.action_id),
  );
  return {
    ...live,
    results: kept,
    current,
    problems: live.problems.filter((p) => !sk.has(p.action_id)),
    succeeded: kept.filter((r) => r.ok).length,
    failed: kept.filter((r) => !r.ok).length,
    queue: [...items.filter((i) => i.kind === "sim" && i.level === "critical"), ...queue, ...items.filter((i) => i.kind === "sim" && i.level === "warning")],
    // Newest first; on a tie the simulated row goes above the data's row for that step.
    feed: [...rows, ...live.feed.filter((r) => !ofSkipped(r.key))].map((r, i) => ({ r, i })).sort((a, b) => b.r.time.localeCompare(a.r.time) || a.i - b.i).map(({ r }) => r),
  };
}
