// Derived numbers and "So what" sentences for the Insights screen. Pure functions over
// GET /api/insights + GET /api/missions, so they are easy to check. Backend's soWhat is
// used when it sends one; otherwise these sentences are written from the numbers.
import { ACTION_LABEL, FAILURE_LABEL, FAILURE_PLURAL, locationName } from "./format";
import type { ActionType, FailureType, Insights, MissionSummary, RateStat } from "./types";

/** Below this share of successful steps a bar is drawn as blight (lime) instead of leaf. */
export const WEAK_PCT = 80;
/** Battery level SPOT should dock before reaching. */
export const DOCK_BELOW_PCT = 20;

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
  hidden: number;
  hiddenRuns: number;
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
    dateRange: dateRange(missions),
  };
}

export function heroLead(h: Hero): string {
  const done = `${h.completed} of ${h.runs} missions finished as completed`;
  const tail = "Compare locations, battery levels and inspection types below.";
  if (h.hidden === 0) return `${done}, and none of them hid a high or critical finding. ${tail}`;
  const findings = h.hidden === 1 ? "1 high or critical finding" : `${h.hidden} high or critical findings`;
  const runs = h.hiddenRuns === 1 ? "1 of those runs" : `${h.hiddenRuns} of those runs`;
  return `${done}, but ${findings} across ${runs} still ${h.hidden === 1 ? "needs" : "need"} attention. ${tail}`;
}

// ---------- V1 vs V2 ----------

export function compareSoWhat(i: Insights): string {
  if (i.soWhat.compare) return i.soWhat.compare;
  const v1 = pct(i.compare.V1.actions);
  const v2 = pct(i.compare.V2.actions);
  if (v2 === v1) return `V1 and V2 recorded the same step success: ${v2}%. Configuration is not what separates good runs.`;
  const better = v2 > v1 ? "V2" : "V1";
  return `${better} recorded higher success: ${Math.max(v1, v2)}% versus ${Math.min(v1, v2)}%. Compare similar routes before changing configuration.`;
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

export function heatmapSoWhat(i: Insights): string {
  if (i.soWhat.byLocation) return i.soWhat.byLocation;
  const h = hotspot(i);
  if (!h) return "No stop recorded a finding across these runs.";
  return `${h.location_name} (${h.location_id}) is the hotspot: ${h.problems} problems and ${failShare(h.okPct)}, so walk it first when a tech goes out.`;
}

/** "Next worst: Turbine Hall South (WP09), 6 problems and 64% of steps ok. Inspection Dock (WP15), 69% of steps ok." */
export function nextWorst(i: Insights): string | null {
  const ranked = byProblems(i.byLocation);
  const second = ranked[1];
  if (!second || second.problems === 0) return null;
  let s = `Next worst: ${second.location_name} (${second.location_id}), ${second.problems} problems and ${pct(second.actions)}% of steps ok.`;
  const shown = new Set([ranked[0].location_id, second.location_id]);
  const weakest = [...i.byLocation]
    .filter((l) => !shown.has(l.location_id) && l.actions.total > 0)
    .sort((a, b) => a.actions.pct - b.actions.pct)[0];
  if (weakest) s += ` ${weakest.location_name} (${weakest.location_id}), ${pct(weakest.actions)}% of steps ok.`;
  return s;
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
  const low = i.batteryBuckets.find((b) => b.max < DOCK_BELOW_PCT);
  if (!low || low.actions.total === 0) return `No steps ran below ${DOCK_BELOW_PCT}% battery.`;
  const { succeeded, total } = low.actions;
  return `Only ${succeeded} of ${total} steps succeeded below ${DOCK_BELOW_PCT}% battery. Plan to dock before reaching ${DOCK_BELOW_PCT}%.`;
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

/** Tooltip / screen-reader text per stop on the heatmap. */
export function stopLabel(i: Insights, locationId: string): string {
  const row = i.byLocation.find((l) => l.location_id === locationId);
  const name = row?.location_name ?? locationName(locationId);
  if (!row) return name;
  const p = row.problems === 1 ? "1 problem" : `${row.problems} problems`;
  return `${name} (${locationId}): ${p}, ${pct(row.actions)}% of steps ok`;
}
