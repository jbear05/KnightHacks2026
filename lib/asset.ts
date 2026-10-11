// Derived numbers and wording for Asset Detail. Pure functions over AssetDetail so they are easy to check.
import { numberWord, plural, readingValue } from "./format";
import { SERIOUS } from "./report";
import type { Action, ActionType, AssetDetail, FailureType, MeasurementType, Problem, Reading } from "./types";

const DAY_MS = 86_400_000;

/** Plant-local timestamps carry no zone; read them as UTC so day maths never shifts. */
export function msOf(ts: string): number {
  return Date.parse(`${ts.slice(0, 19)}Z`);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-05T02:29:42" -> "5 Sep" */
export function dayLabel(ts: string): string {
  return `${Number(ts.slice(8, 10))} ${MONTHS[Number(ts.slice(5, 7)) - 1]}`;
}

/** "2026-09-05T02:29:42" -> "5 Sep 02:29" */
export function dayTime(ts: string): string {
  return `${dayLabel(ts)} ${ts.slice(11, 16)}`;
}

export const MEASUREMENT: Record<
  Exclude<MeasurementType, "LOCALIZATION_CONFIDENCE_PCT">,
  { name: string; scale: string; noun: [string, string]; action: ActionType }
> = {
  PRESSURE_PSI: { name: "Pressure", scale: "psi", noun: ["gauge reading", "gauge readings"], action: "GAUGE_READING" },
  VISUAL_SCORE: { name: "Visual score", scale: "0 to 100", noun: ["visual check", "visual checks"], action: "VISUAL_INSPECTION" },
  TEMPERATURE_C: { name: "Temperature", scale: "°C", noun: ["heat check", "heat checks"], action: "THERMAL_INSPECTION" },
  SOUND_DB: { name: "Sound", scale: "dB", noun: ["sound check", "sound checks"], action: "ACOUSTIC_INSPECTION" },
};

/** The step as an operator would name it in a sentence. */
const STEP_NOUN: Record<ActionType, string> = {
  NAVIGATION: "walk to stop",
  VISUAL_INSPECTION: "visual check",
  THERMAL_INSPECTION: "heat check",
  ACOUSTIC_INSPECTION: "sound check",
  GAUGE_READING: "gauge step",
};

const FAILURE_VERB: Record<FailureType, string> = {
  READING_UNRELIABLE: "gave an unreliable reading",
  SENSOR_TIMEOUT: "timed out",
  TARGET_NOT_DETECTED: "missed its target",
  LOCALIZATION_FAILURE: "lost the robot's position",
  COMMUNICATION_LOSS: "lost communication",
  SIGNAL_NOISE: "had signal noise",
  OBSTACLE_DETECTION: "hit an obstacle",
  PATH_BLOCKED: "found the path blocked",
};

/** "gauge step timed out", "heat check" */
export function stepPhrase(a: Action): string {
  const noun = STEP_NOUN[a.action_type];
  return a.status === "FAILED" && a.failure_type ? `${noun} ${FAILURE_VERB[a.failure_type]}` : noun;
}

export function actionFor(d: AssetDetail, actionId: string): Action | undefined {
  return d.actions?.find((a) => a.action_id === actionId);
}

/** Readings the chart can show: equipment health only (the API already drops localization, D4). */
export function equipmentReadings(d: AssetDetail): Reading[] {
  return d.readings.filter((r) => r.measurement_type !== "LOCALIZATION_CONFIDENCE_PCT");
}

export interface Series {
  type: keyof typeof MEASUREMENT;
  readings: Reading[];
}

/** Types with two or more readings get a line chart; single readings are listed as one-offs. */
export function splitSeries(readings: Reading[]): { charts: Series[]; oneOffs: Reading[] } {
  const by = new Map<Series["type"], Reading[]>();
  for (const r of readings) {
    const t = r.measurement_type as Series["type"];
    if (!(t in MEASUREMENT)) continue;
    by.set(t, [...(by.get(t) ?? []), r]);
  }
  const charts: Series[] = [];
  const oneOffs: Reading[] = [];
  // Fixed order (pressure, visual, temperature, sound) so every asset page reads the same way.
  for (const type of Object.keys(MEASUREMENT) as Series["type"][]) {
    const rs = by.get(type);
    if (!rs) continue;
    if (rs.length > 1) charts.push({ type, readings: rs });
    else oneOffs.push(rs[0]);
  }
  return { charts, oneOffs };
}

/** Three-tick y axis: the smallest round step whose two intervals cover every value. */
export function axisFor(values: number[]): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) {
    const min = Math.floor(lo / step) * step;
    if (min + 2 * step >= hi) return { min, max: min + 2 * step, ticks: [min, min + step, min + 2 * step] };
  }
  return { min: lo, max: hi, ticks: [lo, (lo + hi) / 2, hi] };
}

/** Whole days covered by the asset's history, first to last: the shared x axis. */
export function dayRange(d: AssetDetail): { start: number; days: number; from: string; to: string } | null {
  const stamps = [...d.readings.map((r) => r.timestamp), ...d.problems.map((p) => p.timestamp)].sort();
  if (stamps.length === 0) return null;
  const from = stamps[0];
  const to = stamps[stamps.length - 1];
  const start = msOf(`${from.slice(0, 10)}T00:00:00`);
  const end = msOf(`${to.slice(0, 10)}T00:00:00`) + DAY_MS;
  return { start, days: Math.round((end - start) / DAY_MS), from, to };
}

/** Position of a timestamp on the x axis, 0..1. */
export function xFrac(ts: string, range: { start: number; days: number }): number {
  return (msOf(ts) - range.start) / (range.days * DAY_MS);
}

/** "1 to 10 Sep 2026" */
export function rangeLabel(from: string, to: string): string {
  const year = to.slice(0, 4);
  if (from.slice(0, 10) === to.slice(0, 10)) return `${dayLabel(to)} ${year}`;
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const start = sameMonth ? String(Number(from.slice(8, 10))) : dayLabel(from);
  return `${start} to ${dayLabel(to)} ${year}`;
}

/** Where to print a point's value so it clears the line: under a dip, beside a questioned dip. */
export function labelSide(rs: Reading[], i: number): "above" | "below" | "left" {
  const v = rs[i].value;
  const prev = rs[i - 1]?.value;
  const next = rs[i + 1]?.value;
  const dip = (prev === undefined || v < prev) && (next === undefined || v < next) && rs.length > 1;
  if (!dip) return "above";
  return rs[i].quality === "QUESTIONABLE" ? "left" : "below";
}

/**
 * Problem markers alternate between two rows when they sit close together, so neighbours
 * never overlap. `gap` is in days.
 */
export function laneRows(problems: Problem[], gap = 0.75): Map<string, 0 | 1> {
  const sorted = [...problems].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const rows = new Map<string, 0 | 1>();
  let prev: { t: number; row: 0 | 1 } | null = null;
  for (const p of sorted) {
    const t = msOf(p.timestamp);
    const row: 0 | 1 = prev && (t - prev.t) / DAY_MS < gap ? (prev.row === 0 ? 1 : 0) : 0;
    rows.set(p.anomaly_id, row);
    prev = { t, row };
  }
  return rows;
}

export function isSerious(p: Problem): boolean {
  return SERIOUS.includes(p.severity);
}

/** A serious problem not hidden in a completed mission can only come from a failed one. */
export function missionFailed(p: Problem): boolean {
  return isSerious(p) && !p.hidden_in_completed;
}

/** The context after the location on a past-problem row. */
export function problemContext(d: AssetDetail, p: Problem): string | null {
  if (missionFailed(p)) return "mission failed";
  if (p.location_id !== d.location_id) return "logged away from its home stop";
  const r = d.readings.find((x) => x.action_id === p.action_id);
  if (r) {
    const name = MEASUREMENT[r.measurement_type as Series["type"]]?.name.toLowerCase();
    const value = r.unit === "score" ? String(r.value) : readingValue(r);
    return `${name} ${value}${r.quality === "QUESTIONABLE" ? ", check sensor" : ""}`;
  }
  const a = actionFor(d, p.action_id);
  return a ? stepPhrase(a) : null;
}

export interface FailedStep {
  action: Action;
  /** The equipment reading the step still produced, if any (localization telemetry is never here). */
  reading: Reading | undefined;
  /** A NAVIGATION step: a robot walk failure, not an equipment check. */
  walk: boolean;
  /** SPOT ran the step away from the asset's home stop. */
  away: boolean;
}

/** Failed steps on this asset, oldest first; null when the API sent no actions list. */
export function failedSteps(d: AssetDetail): FailedStep[] | null {
  if (!d.actions) return null;
  const rs = equipmentReadings(d);
  return d.actions
    .filter((a) => a.status === "FAILED")
    .map((a) => ({
      action: a,
      reading: rs.find((r) => r.action_id === a.action_id),
      walk: a.action_type === "NAVIGATION",
      away: a.location_id !== d.location_id,
    }));
}

export interface AssetFacts {
  readings: number;
  questionable: number;
  problems: number;
  hidden: number;
  lastVisit: string | null;
}

export function factsOf(d: AssetDetail): AssetFacts {
  const rs = equipmentReadings(d);
  const stamps = [...rs.map((r) => r.timestamp), ...d.problems.map((p) => p.timestamp), ...(d.actions ?? []).map((a) => a.timestamp)].sort();
  return {
    readings: rs.length,
    questionable: rs.filter((r) => r.quality === "QUESTIONABLE").length,
    problems: d.problems.length,
    hidden: d.problems.filter((p) => p.hidden_in_completed).length,
    lastVisit: stamps.length ? stamps[stamps.length - 1] : null,
  };
}

/** Second headline line: "5 findings in 10 days." */
export function findingsLine(d: AssetDetail): string {
  const n = d.problems.length;
  if (n === 0) return "No findings on record.";
  const range = dayRange(d);
  const span = range ? ` in ${plural(range.days, "day")}` : "";
  return `${plural(n, "finding")}${span}.`;
}

/** How a sentence names the asset: "panel", "heat exchanger", "gauge". */
export function assetNoun(type: string): string {
  const last = type.split(" ").pop() ?? type;
  return ["Panel", "Gauge"].includes(last) ? last.toLowerCase() : type.toLowerCase();
}

/** Lead sentence under the headline. */
export function leadSentence(d: AssetDetail): string {
  const noun = assetNoun(d.asset_type);
  const inspections = d.actions?.filter((a) => a.action_type !== "NAVIGATION").length;
  const rs = equipmentReadings(d).length;
  let s =
    inspections !== undefined
      ? `SPOT inspected this ${noun} ${inspections === 1 ? "once" : inspections === 2 ? "twice" : `${inspections} times`}.`
      : `SPOT took ${plural(rs, "equipment reading")} on this ${noun}.`;
  const n = d.problems.length;
  if (n === 0) return `${s} No findings were recorded.`;
  s += ` ${numberWord(n)} ${n === 1 ? "finding was" : "findings were"} recorded`;
  const hidden = d.problems.filter((p) => p.hidden_in_completed).length;
  if (hidden > 0) {
    s += `, including ${numberWord(hidden).toLowerCase()} serious ${hidden === 1 ? "finding" : "findings"} in completed missions`;
  }
  return `${s}.`;
}

/** Kit sample photo per inspection type (one per type, not one per reading). */
export const PHOTO: Partial<Record<ActionType, { src: string; caption: string; kind: string }>> = {
  GAUGE_READING: { src: "/inspections/gauge_pressure_01.jpg", caption: "Gauge reading", kind: "gauge" },
  VISUAL_INSPECTION: { src: "/inspections/visual_pump_motor_01.jpg", caption: "Visual check", kind: "visual" },
  THERMAL_INSPECTION: { src: "/inspections/thermal_pump_bearing_01.jpg", caption: "Heat check", kind: "thermal" },
  ACOUSTIC_INSPECTION: { src: "/inspections/acoustic_valve_01.jpg", caption: "Sound check", kind: "acoustic" },
};

/**
 * The inspection type behind the highest-priority problem that has one, else the most-read type.
 * PANEL-212: M017's problem was a walk step, so M014's gauge step wins.
 */
export function photoType(d: AssetDetail): ActionType | null {
  for (const p of d.problems) {
    const a = actionFor(d, p.action_id);
    if (a && PHOTO[a.action_type]) return a.action_type;
    const r = d.readings.find((x) => x.action_id === p.action_id);
    const t = r && MEASUREMENT[r.measurement_type as Series["type"]]?.action;
    if (t) return t;
  }
  const { charts, oneOffs } = splitSeries(equipmentReadings(d));
  const top = [...charts].sort((a, b) => b.readings.length - a.readings.length)[0]?.type ?? oneOffs[0]?.measurement_type;
  return top ? (MEASUREMENT[top as Series["type"]]?.action ?? null) : null;
}
