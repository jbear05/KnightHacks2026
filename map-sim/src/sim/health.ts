/**
 * Component health and remaining life.
 *
 * Health score (0-100) comes from the data: readings close to our limits,
 * QUESTIONABLE readings, and failed inspections. Every point lost has a reason.
 *
 * Remaining life is SIMULATED. The data has no install dates, no failure
 * history and only ~10 days of readings (at most 7 of one kind per component),
 * far too little to forecast from a trend. So: assume a design life per
 * component type, assume each component is half way through it, and scale what
 * is left by health. A heat wave shortens it with the "10 degree rule" (life
 * roughly halves for every +10 C, a common rule of thumb for electrical gear).
 * Every assumption is in LIFE below so it can be explained or changed.
 */
import type { MissionData, MissionReading, Alert } from "./scenario.ts";

export const LIFE = {
  /** Design life in years by asset id prefix (our assumption, typical orders of magnitude). */
  designYears: { HX: 20, PANEL: 25, PUMP: 12, COMP: 15, MOTOR: 15, VALVE: 20, GAUGE: 10 } as Record<string, number>,
  typeName: { HX: "Heat exchanger", PANEL: "Electrical panel", PUMP: "Pump", COMP: "Compressor",
              MOTOR: "Motor", VALVE: "Valve", GAUGE: "Gauge" } as Record<string, string>,
  /** Every component is assumed to be this far through its design life (the data has no ages). */
  usedFraction: 0.5,
  /** Remaining life = design x (1 - used) x (health/100)^healthExponent. */
  healthExponent: 2,
  /** Life halves for every this many C of extra heat (10 degree rule of thumb). */
  halvingC: 10,
  /** Alert when the simulated remaining life is at or under these (months). */
  warnMonths: 18,
  criticalMonths: 6,
  /** Points lost (caps keep one kind of problem from dominating). */
  perFailedInspection: 6, failedCap: 30,
  perQuestionable: 4, questionableCap: 20,
  readingsCap: 40,
};

/**
 * Points lost for one reading. Bands are our assumption: the data has no limits.
 * Localization confidence is robot telemetry, not equipment health, so it is ignored.
 */
export function readingPenalty(r: Pick<MissionReading, "measurement_type" | "value">): { points: number; why: string } | null {
  const v = r.value;
  switch (r.measurement_type) {
    case "TEMPERATURE_C":
      if (v >= 80) return { points: 15, why: `${v}°C (≥ 80°C)` };
      if (v >= 70) return { points: 6, why: `${v}°C (≥ 70°C)` };
      return null;
    case "PRESSURE_PSI":
      if (v >= 140) return { points: 12, why: `${v} psi (≥ 140 psi)` };
      if (v >= 125) return { points: 5, why: `${v} psi (≥ 125 psi)` };
      return null;
    case "SOUND_DB":
      if (v >= 80) return { points: 10, why: `${v} dB (≥ 80 dB)` };
      if (v >= 75) return { points: 4, why: `${v} dB (≥ 75 dB)` };
      return null;
    case "VISUAL_SCORE":
      if (v < 72) return { points: 12, why: `visual score ${v} (< 72)` };
      if (v < 80) return { points: 5, why: `visual score ${v} (< 80)` };
      return null;
    default:
      return null;
  }
}

export interface Reason { points: number; text: string }

export interface ComponentHealth {
  asset_id: string;
  type: string;                 // "Heat exchanger"
  score: number;                // 0..100, from the data
  reasons: Reason[];            // biggest first
  inspections: number;          // non-navigation actions on this asset
  failed: number;
  questionable: number;
  readings: number;             // equipment readings (localization excluded)
  designYears: number;          // assumption
  remainingMonths: number;      // SIMULATED, normal conditions
  stops: string[];              // where SPOT inspected it, most often first
}

const prefix = (assetId: string) => assetId.split("-")[0];

/** Health of every component in the data, keyed by asset id. Uses all missions. */
export function componentHealth(data: MissionData): Map<string, ComponentHealth> {
  const out = new Map<string, ComponentHealth>();
  const ids = [...new Set(data.actions.map(a => a.asset_id))].sort();
  for (const id of ids) {
    const acts = data.actions.filter(a => a.asset_id === id && a.action_type !== "NAVIGATION");
    const reads = data.readings.filter(r => r.asset_id === id && r.measurement_type !== "LOCALIZATION_CONFIDENCE_PCT");
    if (!acts.length && !reads.length) continue;   // only ever a navigation target
    const failed = acts.filter(a => a.status === "FAILED").length;
    const questionable = reads.filter(r => r.quality === "QUESTIONABLE").length;

    const reasons: Reason[] = [];
    const hits = reads.map(readingPenalty).filter((p): p is { points: number; why: string } => !!p).sort((a, b) => b.points - a.points);
    const readPts = Math.min(LIFE.readingsCap, hits.reduce((s, h) => s + h.points, 0));
    if (readPts) reasons.push({ points: readPts, text: `${hits.length} of ${reads.length} readings near the limits, worst ${hits[0].why}` });
    const failPts = Math.min(LIFE.failedCap, failed * LIFE.perFailedInspection);
    if (failPts) reasons.push({ points: failPts, text: `${failed} of ${acts.length} inspections failed, so its condition can't be confirmed` });
    const qPts = Math.min(LIFE.questionableCap, questionable * LIFE.perQuestionable);
    if (qPts) reasons.push({ points: qPts, text: `${questionable} questionable reading${questionable > 1 ? "s" : ""}` });
    reasons.sort((a, b) => b.points - a.points);

    const score = Math.max(5, 100 - readPts - failPts - qPts);
    const designYears = LIFE.designYears[prefix(id)] ?? 15;
    const remainingMonths = designYears * 12 * (1 - LIFE.usedFraction) * (score / 100) ** LIFE.healthExponent;
    const count = new Map<string, number>();
    for (const a of acts) count.set(a.location_id, (count.get(a.location_id) ?? 0) + 1);
    out.set(id, {
      asset_id: id, type: LIFE.typeName[prefix(id)] ?? "Component", score, reasons,
      inspections: acts.length, failed, questionable, readings: reads.length,
      designYears, remainingMonths,
      stops: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
    });
  }
  return out;
}

/** Remaining life if the extra heat lasts (10 degree rule). */
export function remainingWithHeat(h: Pick<ComponentHealth, "remainingMonths">, extraC: number): number {
  return h.remainingMonths * 2 ** (-Math.max(0, extraC) / LIFE.halvingC);
}

/**
 * Components that belong to a stop, weakest first. A component belongs to the
 * stop where SPOT inspects it most (a few are also checked elsewhere now and then).
 */
export function componentsAt(health: Map<string, ComponentHealth>, stopId: string): ComponentHealth[] {
  return [...health.values()].filter(h => h.stops[0] === stopId).sort((a, b) => a.score - b.score);
}

/** "8 months", "3.5 years", "less than a month". */
export function formatLife(months: number): string {
  if (months < 1) return "less than a month";
  if (months < 24) return `${Math.round(months)} month${Math.round(months) === 1 ? "" : "s"}`;
  return `${(Math.round(months / 6) / 2).toString()} years`;
}

/** Alert when SPOT inspects a component with little life left. Always simulated. */
export function lifeAlert(h: ComponentHealth, stopName: string, stopId: string, actionId: string | null, extraC = 0): Alert | null {
  const months = remainingWithHeat(h, extraC);
  if (months > LIFE.warnMonths) return null;
  const critical = months <= LIFE.criticalMonths;
  const heat = extraC > 0 ? ` with the heat wave (${formatLife(h.remainingMonths)} normally)` : "";
  return {
    id: `life-${h.asset_id}`, level: critical ? "critical" : "warning", simulated: true,
    location_id: stopId, action_id: actionId,
    title: `${h.asset_id}: about ${formatLife(months)} of life left`,
    detail: `${h.type} at ${stopName}, health ${h.score}/100${heat}. ${h.reasons[0]?.text ?? ""}. ${critical ? "Replace or service it now." : "Plan a service."}`,
  };
}
