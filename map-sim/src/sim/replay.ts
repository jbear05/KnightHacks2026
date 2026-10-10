/**
 * The decision logic of a mission replay, without any drawing: which alerts each
 * step raises, whether SPOT has to skip a step, and how far the mission is.
 * The sandbox drives SPOT's walking and calls into this; the tests run whole
 * missions through it directly.
 */
import type { Stop } from "./types.ts";
import type { Alert, AlertLevel, MissionAction, MissionData } from "./scenario.ts";
import {
  missionActions, missionProgress, heatWaveExtraC, heatAlert, dockChargerAlert, actionAlerts,
} from "./scenario.ts";
import type { ComponentHealth } from "./health.ts";
import { lifeAlert } from "./health.ts";

const RANK: Record<AlertLevel, number> = { info: 0, warning: 1, critical: 2 };

/** An alert as shown in the feed: when it was (last) raised, plant time. */
export interface FeedAlert extends Alert { at: string }

/**
 * The alerts raised so far, newest first. Raising the same id again does
 * nothing, unless it is more severe now (e.g. a component's life alert going
 * from warning to critical): then the entry is replaced and moves to the top.
 */
export class AlertFeed {
  private items: FeedAlert[] = [];

  get list(): readonly FeedAlert[] { return this.items; }

  count(level: AlertLevel): number { return this.items.filter(a => a.level === level).length; }

  get(id: string): FeedAlert | undefined { return this.items.find(a => a.id === id); }

  /** Returns the feed entry if it is new or escalated (worth a banner), else null. */
  add(alert: Alert | null | undefined, at = ""): FeedAlert | null {
    if (!alert) return null;
    const i = this.items.findIndex(a => a.id === alert.id);
    if (i >= 0) {
      if (RANK[alert.level] <= RANK[this.items[i].level]) return null;
      this.items.splice(i, 1);
    }
    const entry = { ...alert, at };
    this.items.unshift(entry);
    return entry;
  }
}

export interface ReplayStep {
  act: MissionAction;
  i: number;
  n: number;
  prog: number;   // this step's progress through the mission, 0..1
}

/**
 * One replay of one mission. Call beginAction(i) before SPOT heads to step i,
 * completeAction(i) once it has done it, and finish() at the end.
 * `progress` drives the heat wave: 0 before the first step, the current step's
 * progress while running, and it stays at 1 after the mission finishes.
 */
export class MissionRun {
  readonly data: MissionData;
  readonly health: Map<string, ComponentHealth>;
  readonly stops: Record<string, Stop>;
  readonly dock: Stop;
  readonly missionId: string;
  readonly actions: MissionAction[];
  readonly feed = new AlertFeed();
  progress = 0;
  step: ReplayStep | null = null;
  finished = false;

  constructor(data: MissionData, health: Map<string, ComponentHealth>, stops: Record<string, Stop>, dock: Stop, missionId: string) {
    this.data = data;
    this.health = health;
    this.stops = stops;
    this.dock = dock;
    this.missionId = missionId;
    this.actions = missionActions(data, missionId);
  }

  /** Plant time of the current step ("18:06:12"), for the feed. */
  get at(): string { return this.step ? this.step.act.timestamp.slice(11, 19) : ""; }

  /** Extra air temperature from the heat wave right now. */
  extraC(heatC: number): number { return heatWaveExtraC(this.progress, heatC); }

  /** Add an alert to the feed (new or escalated entries are returned for a banner). */
  raise(alert: Alert | null | undefined): FeedAlert | null { return this.feed.add(alert, this.at); }

  /** Before SPOT heads to step i: heat checks. skip = too hot, SPOT must not go. */
  beginAction(i: number, heatC: number): { step: ReplayStep; skip: boolean; raised: FeedAlert[] } {
    const act = this.actions[i];
    const prog = missionProgress(this.actions, act);
    this.step = { act, i, n: this.actions.length, prog };
    this.progress = prog;
    const stop = this.stops[act.location_id];
    const hot = heatAlert(stop, prog, heatC, act.action_id);
    const raised = [this.raise(dockChargerAlert(this.dock, prog, heatC)), this.raise(hot)].filter((a): a is FeedAlert => !!a);
    return { step: this.step, skip: hot?.level === "critical", raised };
  }

  /** Once SPOT has done step i: what the data says, the heat wave's effect, component life. */
  completeAction(i: number, heatC: number): FeedAlert[] {
    const act = this.actions[i];
    const stop = this.stops[act.location_id];
    const extra = heatWaveExtraC(missionProgress(this.actions, act), heatC);
    const alerts: (Alert | null)[] = actionAlerts(act, this.data.readings, stop, extra);
    const h = this.health.get(act.asset_id);
    if (h && act.action_type !== "NAVIGATION") alerts.push(lifeAlert(h, stop.name, stop.id, act.action_id, extra));
    return alerts.map(a => this.raise(a)).filter((a): a is FeedAlert => !!a);
  }

  /** The mission is over: no current step, but the heat stays at its end-of-mission level. */
  finish(): void {
    this.step = null;
    this.progress = 1;
    this.finished = true;
  }

  /** Every step in order, as if SPOT reached each one (no walking). Used by tests and summaries. */
  runAll(heatC: number): this {
    this.actions.forEach((_, i) => { if (!this.beginAction(i, heatC).skip) this.completeAction(i, heatC); });
    this.finish();
    return this;
  }
}
