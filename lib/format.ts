// Plain-English labels for operators (FRONTEND_PLAN.md section 5). Components never print raw enums.
import { ASSETS, LOCATIONS } from "./reference";
import type { ActionType, AnomalyType, Criticality, FailureType, Reading, Severity } from "./types";

export const ACTION_LABEL: Record<ActionType, string> = {
  NAVIGATION: "Walk to stop",
  VISUAL_INSPECTION: "Visual check",
  THERMAL_INSPECTION: "Heat check",
  ACOUSTIC_INSPECTION: "Sound check",
  GAUGE_READING: "Gauge reading",
};

export const FAILURE_LABEL: Record<FailureType, string> = {
  READING_UNRELIABLE: "Reading unreliable",
  SENSOR_TIMEOUT: "Sensor timeout",
  TARGET_NOT_DETECTED: "Target not detected",
  LOCALIZATION_FAILURE: "Lost robot position",
  COMMUNICATION_LOSS: "Communication loss",
  SIGNAL_NOISE: "Signal noise",
  OBSTACLE_DETECTION: "Obstacle in the way",
  PATH_BLOCKED: "Path blocked",
};

/** Short form used under a step on the route vine ("WP09 · timeout"). */
export const FAILURE_SHORT: Record<FailureType, string> = {
  READING_UNRELIABLE: "unreliable",
  SENSOR_TIMEOUT: "timeout",
  TARGET_NOT_DETECTED: "target missed",
  LOCALIZATION_FAILURE: "lost position",
  COMMUNICATION_LOSS: "signal lost",
  SIGNAL_NOISE: "noisy signal",
  OBSTACLE_DETECTION: "obstacle",
  PATH_BLOCKED: "path blocked",
};

/** Plural label for the "What needs attention" evidence list. */
export const FAILURE_PLURAL: Record<FailureType, string> = {
  READING_UNRELIABLE: "Unreliable readings",
  SENSOR_TIMEOUT: "Sensor timeouts",
  TARGET_NOT_DETECTED: "Targets not detected",
  LOCALIZATION_FAILURE: "Lost robot position",
  COMMUNICATION_LOSS: "Communication losses",
  SIGNAL_NOISE: "Noisy signals",
  OBSTACLE_DETECTION: "Obstacles in the way",
  PATH_BLOCKED: "Blocked paths",
};

export const ANOMALY_LABEL: Record<AnomalyType, string> = {
  ABNORMAL_VIBRATION: "Abnormal vibration",
  SIGNAL_DEGRADATION: "Signal degradation",
  GAUGE_OUT_OF_RANGE: "Gauge out of range",
  VISUAL_DEFECT: "Visual defect",
  ABNORMAL_TEMPERATURE: "Abnormal temperature",
  NAVIGATION_OBSTRUCTION: "Navigation obstruction",
  LOCALIZATION_ISSUE: "Localization issue",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

/** "critical asset", "high-criticality asset" */
export function criticalityPhrase(c: Criticality): string {
  return c === "CRITICAL" ? "critical asset" : `${c.toLowerCase()}-criticality asset`;
}

/** "WP06" -> "Compressor Area" */
export function locationName(id: string): string {
  return LOCATIONS[id]?.location_name ?? id;
}

/** "WP06" -> "Compressor Area (WP06)" */
export function locationLabel(id: string): string {
  const name = LOCATIONS[id]?.location_name;
  return name ? `${name} (${id})` : id;
}

export function floorOf(id: string): 1 | 2 | null {
  return LOCATIONS[id]?.floor ?? null;
}

export function assetOf(id: string) {
  return ASSETS[id] ?? null;
}

/** "2026-09-06T02:07:48" -> "02:07:48" (plant-local, never converted). */
export function timeOf(ts: string, withSeconds = true): string {
  const t = ts.split("T")[1] ?? ts;
  return withSeconds ? t.slice(0, 8) : t.slice(0, 5);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-06T02:00:00" -> "06 Sep 2026" */
export function dateOf(ts: string): string {
  const [y, m, d] = ts.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** "136.8 psi", "68.8 dB", "score 70", "48.8%" */
export function readingValue(r: Pick<Reading, "value" | "unit">): string {
  switch (r.unit) {
    case "score":
      return `score ${r.value}`;
    case "pct":
      return `${r.value}%`;
    case "C":
      return `${r.value.toFixed(1)} °C`;
    default:
      return `${r.value.toFixed(1)} ${r.unit}`;
  }
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** 2 -> "Two" (falls back to digits above ten). */
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
