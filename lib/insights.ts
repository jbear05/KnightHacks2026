// Derived numbers and "So what" sentences for the Insights screen. Pure functions over
// GET /api/insights + GET /api/missions, so they are easy to check. Backend's soWhat is
// used when it sends one; otherwise these sentences are written from the numbers.
import { ACTION_LABEL, FAILURE_LABEL, FAILURE_PLURAL, locationName } from "./format";
import type { ActionType, FailureType, Insights, MissionSummary, RateStat } from "./types";

/** Below this share of successful steps a bar is drawn as blight (lime) instead of leaf. */
export const WEAK_PCT = 80;
/** Suggested docking heuristic, from one small descriptive bucket; not a measured optimum. */
export const DOCK_BELOW_PCT = 20;
/** Groups with fewer steps than this are labelled "small sample". */
export const SMALL_GROUP = 20;
/** Stops need at least this many steps to be ranked by failure rate. */
export const MIN_RANKED_STEPS = 10;

/** Whole percent, the way every chart prints it. */
export const pct = (r: RateStat) => Math.round(r.pct);

const ACTION_PLURAL: Record<ActionType, string> = {
  NAVIGATION: "Walks to a stop",
  VISUAL_INSPECTION: "Visual checks",
  THERMAL_INSPECTION: "Heat checks",
  ACOUSTIC_INSPECTION: "Sound checks",
  GAUGE_READING: "Gauge readings",
};

/** Words for the "Other (...)" failure bar. */
const OTHER_WORD: Partial<Record<FailureType, string>> = {
  SIGNAL_NOISE: "noise",
  OBSTACLE_DETECTION: "obstacle",
  PATH_BLOCKED: "blocked path",
};

/** Readings and timeouts are data-quality failures (lime); everything else is pink. */
export const DATA_QUALITY: FailureType[] = ["READING_UNRELIABLE", "SENSOR_TIMEOUT"];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ---------- Hero ----------

export interface Hero {
  runs: number;
  steps: number;
  completed: number;
  /** Recorded HIGH/CRITICAL findings inside completed missions (historical, never changes). */
  hidden: number;
  hiddenRuns: number;
  /** All recorded HIGH/CRITICAL findings, and those with no saved operator decision yet. */
  serious: number;
  awaiting: number;
  dateRange: string;
}

function dayMonth(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return {
    day: String(d.getUTCDate()).padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    year: d.getUTCFullYear(),
  };
}

/** "01 to 10 Sep 2026", or "28 Aug to 03 Sep 2026" across months. */
export function dateRange(missions: MissionSummary[]): string {
  if (missions.length === 0) return "";
  const starts = missions.map((m) => m.start_time).sort();
  const ends = missions.map((m) => m.end_time ?? m.start_time).sort();
  const a = dayMonth(starts[0]);
  const b = dayMonth(ends[ends.length - 1]);
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year} to ${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.day} ${a.month} to ${b.day} ${b.month} ${b.year}`;
  return `${a.day} to ${b.day} ${b.month} ${b.year}`;
}

export function hero(insights: Insights, missions: MissionSummary[]): Hero {
  return {
    runs: missions.length,
    steps: insights.compare.V1.actions.total + insights.compare.V2.actions.total,
    completed: missions.filter((m) => m.mission_status === "COMPLETED").length,
    hidden: missions.reduce((n, m) => n + m.hidden_problems, 0),
    hiddenRuns: missions.filter((m) => m.hidden_problems > 0).length,
    serious: missions.reduce((n, m) => n + m.serious_problems, 0),
    awaiting: missions.reduce((n, m) => n + (m.awaiting_review ?? m.serious_problems), 0),
    dateRange: dateRange(missions),
  };
}

export function heroLead(h: Hero): string {
  const done = `${h.completed} of ${h.runs} missions finished as completed`;
  const tail = "Compare locations, battery levels and inspection types below.";
  if (h.hidden === 0) return `${done}, and none of them hid a high or critical finding. ${tail}`;
  const findings = h.hidden === 1 ? "1 high or critical finding was" : `${h.hidden} high or critical findings were`;
  const runs = h.hiddenRuns === 1 ? "1 of those runs" : `${h.hiddenRuns} of those runs`;
  const review =
    h.awaiting === 0
      ? `Every serious finding has a saved operator decision, which records a choice, not a confirmed fix.`
      : `${h.awaiting} of ${h.serious} serious findings across all missions have no saved operator decision yet.`;
  return `${done}, but ${findings} recorded in ${runs}. ${review} ${tail}`;
}

// ---------- V1 vs V2 ----------

const ofSteps = (r: RateStat) => `${r.succeeded} of ${r.total}`;

export function compareSoWhat(i: Insights): string {
  if (i.soWhat.compare) return i.soWhat.compare;
  const { V1, V2 } = i.compare;
  const v1 = pct(V1.actions);
  const v2 = pct(V2.actions);
  const caveat = "This is an observed association: the runs differ in route, timing and battery, so it does not show the configuration caused the difference.";
  if (v2 === v1) return `V1 and V2 recorded the same step success: ${v2}% (${ofSteps(V1.actions)} and ${ofSteps(V2.actions)} steps). ${caveat}`;
  const [hi, lo] = v2 > v1 ? (["V2", "V1"] as const) : (["V1", "V2"] as const);
  const rows = configTypeRows(i).filter((r) => r.diff !== null);
  const higher = rows.filter((r) => (hi === "V2" ? r.diff! > 0 : r.diff! < 0)).length;
  const within = rows.length ? ` ${hi} was also higher within ${higher} of ${rows.length} inspection types.` : "";
  return `${hi} recorded higher step success: ${pct(i.compare[hi].actions)}% (${ofSteps(i.compare[hi].actions)}) versus ${pct(i.compare[lo].actions)}% (${ofSteps(i.compare[lo].actions)}) on ${lo}.${within} ${caveat}`;
}

export interface ConfigTypeRow {
  action_type: ActionType;
  label: string;
  V1: RateStat;
  V2: RateStat;
  /** V2 minus V1 in percentage points, one decimal; null when either side has no steps. */
  diff: number | null;
  /** Either side has fewer than SMALL_GROUP steps. */
  small: boolean;
}

/** V1 vs V2 within each inspection type, with denominators. Empty when the API sends no breakdown. */
export function configTypeRows(i: Insights): ConfigTypeRow[] {
  return (i.byConfigType ?? []).map((r) => ({
    action_type: r.action_type,
    label: ACTION_LABEL[r.action_type],
    V1: r.V1,
    V2: r.V2,
    diff: r.V1.total && r.V2.total ? Math.round((r.V2.pct - r.V1.pct) * 10) / 10 : null,
    small: Math.min(r.V1.total, r.V2.total) < SMALL_GROUP,
  }));
}

// ---------- Heatmap ----------

export interface Hotspot {
  location_id: string;
  location_name: string;
  problems: number;
  okPct: number;
}

type LocationRow = Insights["byLocation"][number];

const byProblems = (rows: LocationRow[]) =>
  [...rows].sort((a, b) => b.problems - a.problems || a.actions.pct - b.actions.pct);

export function hotspot(i: Insights): Hotspot | null {
  const top = byProblems(i.byLocation)[0];
  if (!top || top.problems === 0) return null;
  return { location_id: top.location_id, location_name: top.location_name, problems: top.problems, okPct: pct(top.actions) };
}

/** "1 in 4 steps fail there" from a 74% success rate. */
export function failShare(okPct: number): string {
  const fail = 100 - okPct;
  if (fail <= 0) return "no steps fail there";
  return `1 in ${Math.max(1, Math.round(100 / fail))} steps fail there`;
}

/** Stops ranked by step failure rate, among stops with at least MIN_RANKED_STEPS steps. */
export function byFailureRate(i: Insights): LocationRow[] {
  return [...i.byLocation]
    .filter((l) => l.actions.total >= MIN_RANKED_STEPS)
    .sort((a, b) => a.actions.pct - b.actions.pct || b.actions.total - a.actions.total);
}

export function heatmapSoWhat(i: Insights): string {
  if (i.soWhat.byLocation) return i.soWhat.byLocation;
  const h = hotspot(i);
  if (!h) return "No stop recorded a finding across these runs.";
  const top = i.byLocation.find((l) => l.location_id === h.location_id)!;
  let s = `${h.location_name} (${h.location_id}) recorded the most findings: ${h.problems} across ${top.actions.total} steps.`;
  const worst = byFailureRate(i)[0];
  if (worst && worst.location_id !== h.location_id) {
    s += ` ${worst.location_name} (${worst.location_id}) has the lowest step success: ${ofSteps(worst.actions)} ok (${pct(worst.actions)}%).`;
  }
  return `${s} Counts and failure rates rank stops differently, and neither weighs severity.`;
}

export interface LocationRankings {
  byFindings: { location_id: string; location_name: string; problems: number; steps: number }[];
  byFailure: { location_id: string; location_name: string; stat: RateStat; pct: number }[];
}

/** The stops with the most findings and those with the lowest step success, with denominators. */
export function locationRankings(i: Insights, n = 3): LocationRankings {
  return {
    byFindings: byProblems(i.byLocation)
      .filter((l) => l.problems > 0)
      .slice(0, n)
      .map((l) => ({ location_id: l.location_id, location_name: l.location_name, problems: l.problems, steps: l.actions.total })),
    byFailure: byFailureRate(i)
      .slice(0, n)
      .map((l) => ({ location_id: l.location_id, location_name: l.location_name, stat: l.actions, pct: pct(l.actions) })),
  };
}

// ---------- Battery ----------

export interface BatteryBar {
  label: string;
  stat: RateStat;
  pct: number;
  belowDock: boolean;
}

/** "<20%", "20–40", "80%+" from the bucket bounds (Backend's labels are "20-40%" style). */
export function bucketLabel(min: number, max: number): string {
  if (min <= 0) return `<${max + 1}%`;
  if (max >= 100) return `${min}%+`;
  return `${min}–${max + 1}`;
}

export function batteryBars(i: Insights): BatteryBar[] {
  return i.batteryBuckets.map((b) => ({
    label: bucketLabel(b.min, b.max),
    stat: b.actions,
    pct: pct(b.actions),
    belowDock: b.max < DOCK_BELOW_PCT,
  }));
}

export function batterySoWhat(i: Insights): string {
  if (i.soWhat.battery) return i.soWhat.battery;
  const sum = (low: boolean) => {
    const bs = i.batteryBuckets.filter((b) => (b.max < DOCK_BELOW_PCT) === low);
    const total = bs.reduce((n, b) => n + b.actions.total, 0);
    const succeeded = bs.reduce((n, b) => n + b.actions.succeeded, 0);
    return { total, succeeded, pct: total ? Math.round((succeeded / total) * 1000) / 10 : 0 };
  };
  const lo = sum(true);
  const hi = sum(false);
  if (lo.total === 0) return `No steps ran below ${DOCK_BELOW_PCT}% battery, so the data cannot say how low battery affects success.`;
  return (
    `Below ${DOCK_BELOW_PCT}% battery, ${ofSteps(lo)} steps succeeded (${pct(lo)}%), versus ${ofSteps(hi)} (${pct(hi)}%) at ${DOCK_BELOW_PCT}% or above. ` +
    `Only ${lo.total} ${lo.total === 1 ? "step" : "steps"} ran that low, so the rate is uncertain and can reflect other factors such as position in the mission or configuration. Docking before ${DOCK_BELOW_PCT}% is a suggested heuristic, not a measured threshold.`
  );
}

// ---------- Reliability by inspection type ----------

export interface TypeBar {
  action_type: ActionType;
  label: string;
  stat: RateStat;
  pct: number;
  weak: boolean;
}

export function typeBars(i: Insights): TypeBar[] {
  return [...i.byActionType]
    .filter((t) => t.actions.total > 0)
    .sort((a, b) => b.actions.pct - a.actions.pct)
    .map((t) => ({
      action_type: t.action_type,
      label: ACTION_LABEL[t.action_type],
      stat: t.actions,
      pct: pct(t.actions),
      weak: pct(t.actions) < WEAK_PCT,
    }));
}

export function reliabilitySoWhat(i: Insights): string {
  if (i.soWhat.byActionType) return i.soWhat.byActionType;
  const worst = [...typeBars(i)].reverse().slice(0, 2);
  if (worst.length === 0) return "No inspection steps recorded.";
  const names = worst.map((t, n) => (n === 0 ? ACTION_PLURAL[t.action_type] : lower(ACTION_PLURAL[t.action_type])));
  return `${names.join(" and ")} failed most often. Verify questionable readings before diagnosing equipment.`;
}

// ---------- Failure causes ----------

export interface CauseBar {
  key: string;
  label: string;
  count: number;
  dataQuality: boolean;
}

/** Top five causes by count, then one "Other (...)" bar for the rest. */
export function causeBars(i: Insights, named = 5): CauseBar[] {
  const sorted = [...i.failureCauses].sort((a, b) => b.count - a.count);
  const keep = sorted.length > named + 1 ? sorted.slice(0, named) : sorted;
  const rest = sorted.slice(keep.length);
  const bars: CauseBar[] = keep.map((c) => ({
    key: c.failure_type,
    label: FAILURE_LABEL[c.failure_type],
    count: c.count,
    dataQuality: DATA_QUALITY.includes(c.failure_type),
  }));
  if (rest.length > 0) {
    const words = rest.map((c) => OTHER_WORD[c.failure_type] ?? lower(FAILURE_LABEL[c.failure_type]));
    bars.push({ key: "OTHER", label: `Other (${words.join(", ")})`, count: rest.reduce((n, c) => n + c.count, 0), dataQuality: false });
  }
  return bars;
}

export const failedSteps = (i: Insights) => i.failureCauses.reduce((n, c) => n + c.count, 0);

export function causesSoWhat(i: Insights): string {
  if (i.soWhat.failureCauses) return i.soWhat.failureCauses;
  const total = failedSteps(i);
  const top = [...i.failureCauses].sort((a, b) => b.count - a.count).slice(0, 2);
  if (top.length === 0) return "No steps failed across these runs.";
  const n = top.reduce((s, c) => s + c.count, 0);
  const names = top.map((c, k) => (k === 0 ? FAILURE_PLURAL[c.failure_type] : lower(FAILURE_PLURAL[c.failure_type])));
  const verb = top.length === 1 ? "accounts" : "account";
  const fix = top.some((c) => DATA_QUALITY.includes(c.failure_type))
    ? " Verify readings before diagnosing equipment."
    : "";
  return `${names.join(" and ")} ${verb} for ${n} of ${total} failed steps.${fix}`;
}

// ---------- Repeat assets ----------

export function repeatSoWhat(i: Insights): string {
  if (i.soWhat.repeatAssets) return i.soWhat.repeatAssets;
  const [top] = i.repeatAssets;
  if (!top) return "No asset recorded more than one finding.";
  const n = i.repeatAssets.length;
  return `${top.asset_id} (${top.asset_name}) recorded ${top.problems} findings, the most of any asset, and ${n} ${n === 1 ? "asset" : "assets"} recorded more than one. Open an asset's history to see whether its findings share a cause or a questionable sensor.`;
}

/** Tooltip / screen-reader text per stop on the heatmap. */
export function stopLabel(i: Insights, locationId: string): string {
  const row = i.byLocation.find((l) => l.location_id === locationId);
  const name = row?.location_name ?? locationName(locationId);
  if (!row) return name;
  const p = row.problems === 1 ? "1 problem" : `${row.problems} problems`;
  return `${name} (${locationId}): ${p}, ${pct(row.actions)}% of steps ok`;
}
