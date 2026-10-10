// Live Mission state, derived from the replay. Pure functions over (mission, events, clock) so the
// map, the right rail and the replay bar all read one stream and can never disagree.
import { ACTION_LABEL, FAILURE_LABEL, locationLabel, readingValue } from "./format";
import { SERIOUS } from "./report";
import type { Action, ActionType, LiveEvent, MissionDetail, Problem } from "./types";

/** SPOT's start position. The data has no start point; Map & Sim assumes the Main Entrance. */
export const START_LOCATION = "WP01";

/** Plant-local ISO timestamp -> ms. Parsed as UTC so the browser's timezone never shifts it. */
export function msOf(ts: string): number {
  return Date.parse(`${ts}Z`);
}

/** ms -> "02:15:36" (plant-local). */
export function clockOf(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

/** ms -> "15:36" (minutes:seconds, for elapsed time). */
export function durationOf(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Same-timestamp events keep the stream's order: start, result, problems, mission end.
const ORDER: Record<LiveEvent["event_type"], number> = {
  MISSION_STARTED: 0,
  ACTION_STARTED: 1,
  ACTION_COMPLETED: 2,
  ACTION_FAILED: 2,
  PROBLEM_FOUND: 3,
  MISSION_COMPLETED: 4,
};

/**
 * The mission's full event list, rebuilt from GET /api/missions/:id. It matches replay.ndjson
 * (mission start/end, one STARTED + COMPLETED/FAILED per action at the action's timestamp) plus
 * Backend's PROBLEM_FOUND after the action that found it. Having the whole list up front is what
 * lets the operator scrub backwards and forwards. Event ids are synthetic.
 */
export function timelineFromMission(m: MissionDetail): LiveEvent[] {
  const base = { mission_id: m.mission_id };
  const events: LiveEvent[] = [
    {
      ...base,
      event_id: `${m.mission_id}-start`,
      timestamp: m.start_time,
      event_type: "MISSION_STARTED",
      details: { scenario: m.scenario, configuration_version: m.configuration_version, battery_pct: m.start_battery_pct ?? 0 },
    },
  ];
  for (const a of m.actions) {
    events.push({
      ...base,
      event_id: `${a.action_id}-start`,
      timestamp: a.timestamp,
      event_type: "ACTION_STARTED",
      details: { action_id: a.action_id, location_id: a.location_id, asset_id: a.asset_id, action_type: a.action_type, battery_pct: a.battery_pct ?? 0 },
    });
    events.push(
      a.status === "FAILED"
        ? { ...base, event_id: `${a.action_id}-end`, timestamp: a.timestamp, event_type: "ACTION_FAILED", details: { action_id: a.action_id, status: "FAILED", failure_type: a.failure_type ?? "SENSOR_TIMEOUT" } }
        : { ...base, event_id: `${a.action_id}-end`, timestamp: a.timestamp, event_type: "ACTION_COMPLETED", details: { action_id: a.action_id, status: "SUCCESS", failure_type: "" } },
    );
    for (const p of m.problems.filter((p) => p.action_id === a.action_id)) {
      events.push({ ...base, event_id: `P${p.anomaly_id}`, timestamp: a.timestamp, event_type: "PROBLEM_FOUND", details: { action_id: a.action_id, problem: p } });
    }
  }
  if (m.end_time) {
    events.push({
      ...base,
      event_id: `${m.mission_id}-end`,
      timestamp: m.end_time,
      event_type: "MISSION_COMPLETED",
      details: { status: m.mission_status, end_battery_pct: m.end_battery_pct ?? 0 },
    });
  }
  return events
    .map((e, i) => ({ e, i }))
    .sort((x, y) => msOf(x.e.timestamp) - msOf(y.e.timestamp) || ORDER[x.e.event_type] - ORDER[y.e.event_type] || x.i - y.i)
    .map(({ e }) => e);
}

/** Number of events that have happened by `clock` (the replay plays every event at its timestamp). */
export function playedCount(timeline: LiveEvent[], clock: number): number {
  let n = 0;
  while (n < timeline.length && msOf(timeline[n].timestamp) <= clock) n++;
  return n;
}

export type Phase = "walking" | "inspecting";

export interface StepState {
  action: Action;
  /** 1-based position in the plan. */
  step: number;
  phase: Phase;
  /** Where SPOT is walking from. */
  fromLocationId: string;
  /** Mission-clock ms when SPOT reaches the stop and starts the inspection. */
  arriveAt: number;
  /** 0..1 along the walk (1 while inspecting). */
  progress: number;
}

export interface StepResult {
  action: Action;
  ok: boolean;
}

/** One row of the attention queue: a serious problem, or a failed step no problem already covers. */
export type QueueItem =
  | { kind: "problem"; key: string; problem: Problem }
  | { kind: "failed"; key: string; action: Action };

export interface FeedRow {
  key: string;
  time: string;
  glyph: "next" | "bloom" | "blight" | "problem" | "spot";
  text: string;
  detail: string;
}

export interface LiveState {
  /** Steps finished so far, in plan order. */
  results: StepResult[];
  succeeded: number;
  failed: number;
  /** Steps not finished yet (includes the current one). */
  toGo: number;
  /** The step SPOT is walking to or inspecting; null before the mission starts or after it ends. */
  current: StepState | null;
  battery: number | null;
  startBattery: number | null;
  problems: Problem[];
  queue: QueueItem[];
  feed: FeedRow[];
  ended: boolean;
}

/** "Gauge reading" -> "a gauge reading", "Heat check" -> "a heat check" */
export function withArticle(type: ActionType): string {
  const label = ACTION_LABEL[type].toLowerCase();
  return `${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`;
}

export function deriveLive(m: MissionDetail, events: LiveEvent[], clock: number): LiveState {
  const plan = [...m.actions].sort((a, b) => a.sequence - b.sequence);
  const byId = new Map(plan.map((a) => [a.action_id, a]));
  const results: StepResult[] = [];
  const problems: Problem[] = [];
  let battery: number | null = null;
  let started = false;
  let ended = false;

  for (const e of events) {
    switch (e.event_type) {
      case "MISSION_STARTED":
        started = true;
        battery = e.details.battery_pct;
        break;
      case "ACTION_STARTED":
        battery = e.details.battery_pct;
        break;
      case "ACTION_COMPLETED":
      case "ACTION_FAILED": {
        const a = byId.get(e.details.action_id);
        if (a) results.push({ action: a, ok: e.event_type === "ACTION_COMPLETED" });
        break;
      }
      case "PROBLEM_FOUND":
        problems.push(e.details.problem);
        break;
      case "MISSION_COMPLETED":
        ended = true;
        battery = e.details.end_battery_pct;
        break;
    }
  }

  const done = new Set(results.map((r) => r.action.action_id));
  const next = plan.findIndex((a) => !done.has(a.action_id));
  let current: StepState | null = null;
  if (started && !ended && next !== -1) {
    const action = plan[next];
    const prev = next > 0 ? plan[next - 1] : null;
    const leaveAt = prev ? msOf(prev.timestamp) : msOf(m.start_time);
    const dueAt = msOf(action.timestamp);
    const arriveAt = Math.max(leaveAt, dueAt - (action.duration_sec ?? 0) * 1000);
    const walking = clock < arriveAt;
    current = {
      action,
      step: next + 1,
      phase: walking ? "walking" : "inspecting",
      fromLocationId: prev?.location_id ?? START_LOCATION,
      arriveAt,
      progress: walking ? Math.min(1, Math.max(0, (clock - leaveAt) / Math.max(1, arriveAt - leaveAt))) : 1,
    };
  }

  // Attention queue: serious problems first (priority desc), then failed steps without a problem.
  const serious = problems.filter((p) => SERIOUS.includes(p.severity)).sort((a, b) => b.priority - a.priority);
  const covered = new Set(serious.map((p) => p.action_id));
  const queue: QueueItem[] = [
    ...serious.map((p): QueueItem => ({ kind: "problem", key: p.anomaly_id, problem: p })),
    ...results
      .filter((r) => !r.ok && !covered.has(r.action.action_id))
      .reverse()
      .map((r): QueueItem => ({ kind: "failed", key: r.action.action_id, action: r.action })),
  ];

  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    toGo: plan.length - results.length,
    current,
    battery,
    startBattery: m.start_battery_pct,
    problems,
    queue,
    feed: buildFeed(m, events, current),
    ended,
  };
}

function buildFeed(m: MissionDetail, events: LiveEvent[], current: StepState | null): FeedRow[] {
  const byId = new Map(m.actions.map((a) => [a.action_id, a]));
  const rows: FeedRow[] = [];
  for (const e of events) {
    const time = clockOf(msOf(e.timestamp));
    switch (e.event_type) {
      case "MISSION_STARTED":
        rows.push({ key: e.event_id, time, glyph: "spot", text: "Mission started", detail: `· battery ${e.details.battery_pct}%` });
        break;
      case "ACTION_COMPLETED":
      case "ACTION_FAILED": {
        const a = byId.get(e.details.action_id);
        if (!a) break;
        const label = ACTION_LABEL[a.action_type];
        if (e.event_type === "ACTION_FAILED") {
          rows.push({ key: e.event_id, time, glyph: "blight", text: `${label} failed`, detail: `· ${a.location_id} · ${FAILURE_LABEL[e.details.failure_type].toLowerCase()}` });
        } else {
          // Robot telemetry from NAVIGATION steps is not an equipment reading (decision D4).
          const r = a.action_type === "NAVIGATION" ? undefined : m.readings.find((x) => x.action_id === a.action_id);
          rows.push({ key: e.event_id, time, glyph: "bloom", text: `${label} passed`, detail: `· ${a.location_id}${r ? ` · ${readingValue(r)}` : ""}` });
        }
        break;
      }
      case "PROBLEM_FOUND": {
        const p = e.details.problem;
        if (!SERIOUS.includes(p.severity)) break;
        rows.push({ key: e.event_id, time, glyph: "problem", text: `${p.asset_id} needs review`, detail: `· ${p.location_id} · priority ${p.priority}` });
        break;
      }
      case "MISSION_COMPLETED":
        rows.push({
          key: e.event_id,
          time,
          glyph: e.details.status === "FAILED" ? "blight" : "bloom",
          text: e.details.status === "FAILED" ? "Mission failed" : "Mission finished",
          detail: `· battery ${e.details.end_battery_pct}%`,
        });
        break;
    }
  }
  if (current?.phase === "inspecting") {
    const a = current.action;
    rows.push({ key: `${a.action_id}-inspecting`, time: clockOf(current.arriveAt), glyph: "next", text: `${ACTION_LABEL[a.action_type]} started`, detail: `· ${a.location_id}` });
  }
  return rows.reverse();
}

/** "Step 6 of 10 · walking to Control Room Corridor (WP07) for a gauge reading" */
export function stepSentence(s: StepState, total: number): string {
  const where = locationLabel(s.action.location_id);
  const verb = s.phase === "walking" ? (s.progress > 0.8 ? "arriving at" : "walking to") : "at";
  return `Step ${s.step} of ${total} · ${verb} ${where} for ${withArticle(s.action.action_type)}`;
}

// Battery bands shown under the gauge (FRONTEND_PLAN.md: orange < 40, red < 20; Figma shows 40 as a warning).
export const BATTERY_WARN = 40;
export const BATTERY_LOW = 20;

/**
 * Insight from the kit's actions.csv (all 27 missions): steps run below 20% battery succeed 3 of 11
 * times. Static for the demo; the live number comes from GET /api/insights batteryBuckets.
 */
export const LOW_BATTERY_INSIGHT = { succeeded: 3, total: 11 };
