/**
 * Mission replay alerts and "what-if" scenarios (heat wave, obstacle at the dock).
 *
 * Two kinds of alert, always kept apart so nobody mistakes a what-if for data:
 *  - simulated: false -> straight from the kit data (failed steps, low battery,
 *    hot or questionable readings)
 *  - simulated: true  -> only exists because a scenario is switched on
 *
 * The data has no weather, no room temperature and no thresholds. Limits below
 * say where each number comes from: the SPOT user guide in the challenge kit,
 * or our own assumption.
 *
 * Pure functions, no drawing: the sandbox and the map component both use this.
 */
import type { Stop } from "./types.ts";

// ------------------------------------------------------------------ data

export interface MissionAction {
  action_id: string;
  mission_id: string;
  sequence: number;
  timestamp: string;          // "2026-09-01T18:03:06", plant-local
  location_id: string;
  asset_id: string;
  action_type: string;        // NAVIGATION | VISUAL_INSPECTION | ...
  battery_pct: number | null;
  status: "SUCCESS" | "FAILED";
  failure_type: string | null;
  duration_sec: number | null;
  scenario: string;           // BASELINE | IMPROVED
}

export interface MissionReading {
  reading_id: string;
  action_id: string;
  mission_id: string;
  asset_id: string;
  location_id: string;
  timestamp: string;
  measurement_type: string;   // TEMPERATURE_C | SOUND_DB | ...
  value: number;
  unit: string;
  quality: "GOOD" | "QUESTIONABLE";
}

/** data/missions.json */
export interface MissionData {
  actions: MissionAction[];
  readings: MissionReading[];
}

/** One mission's actions, in order. */
export function missionActions(data: MissionData, missionId: string): MissionAction[] {
  return data.actions.filter(a => a.mission_id === missionId).sort((a, b) => a.sequence - b.sequence);
}

/** How far through the mission an action is, 0..1, by timestamp. */
export function missionProgress(actions: MissionAction[], action: MissionAction): number {
  const t = (a: MissionAction) => Date.parse(a.timestamp);
  const t0 = t(actions[0]), t1 = t(actions[actions.length - 1]);
  return t1 > t0 ? Math.min(1, Math.max(0, (t(action) - t0) / (t1 - t0))) : 0;
}

// ------------------------------------------------------------------ limits

export const LIMITS = {
  spotMaxC: 45,            // SPOT user guide: operating temperature -20C to 45C
  chargerMaxC: 40,         // SPOT user guide: charger operating temperature 0C to 40C
  equipmentWarnC: 80,      // our assumption: the data has no normal bands
  equipmentCriticalC: 90,  // our assumption
  lowBatteryPct: 20,       // our assumption, same as the UI's battery warning colour
  lowLocalizationPct: 60,  // our assumption: below this SPOT is unsure where it is
};

/**
 * Heat wave model (simulated). Indoor air starts at baseC, and the heat wave
 * adds half its intensity at the start of the mission, climbing to the full
 * intensity by the end. Machinery rooms run hotter than corridors, and floor 2
 * a little hotter than floor 1. Equipment readings rise with the air.
 */
export const HEAT = {
  baseC: 26,
  zoneC: { ACCESS: 0, ELECTRICAL: 2, PROCESS: 4, MECHANICAL: 5 } as Record<string, number>,
  floor2C: 1,
  equipmentGain: 0.9,      // equipment gets 0.9 C hotter per 1 C of extra air temperature
};

/** How much the heat wave adds to the air, in C, at this point of the mission. */
export function heatWaveExtraC(progress: number, intensityC: number): number {
  return Math.max(0, intensityC) * (0.5 + 0.5 * progress);
}

/** Simulated air temperature at a stop, in C. intensityC = 0 means no heat wave. */
export function ambientC(stop: Pick<Stop, "zone" | "floor">, progress: number, intensityC: number): number {
  return HEAT.baseC + heatWaveExtraC(progress, intensityC) + (HEAT.zoneC[stop.zone] ?? 0) + (stop.floor === 2 ? HEAT.floor2C : 0);
}

// ------------------------------------------------------------------ alerts

export type AlertLevel = "info" | "warning" | "critical";

export interface Alert {
  id: string;                 // stable, so the same alert is never shown twice
  level: AlertLevel;
  simulated: boolean;
  title: string;              // short: "Too hot for SPOT"
  detail: string;             // one sentence with the numbers and where the limit comes from
  location_id: string | null;
  action_id: string | null;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Heat check before SPOT walks to a stop. Critical = SPOT must not go there
 * (skip the stop); warning = it can go, but it is close to its limit.
 */
export function heatAlert(stop: Stop, progress: number, intensityC: number, actionId: string | null = null): Alert | null {
  if (intensityC <= 0) return null;
  const c = round(ambientC(stop, progress, intensityC));
  const base = { simulated: true, location_id: stop.id, action_id: actionId };
  if (c > LIMITS.spotMaxC) return {
    ...base, id: `heat-stop-${stop.id}-${actionId}`, level: "critical", title: "Too hot for SPOT: stop skipped",
    detail: `${stop.name} is at ${c}°C, above SPOT's ${LIMITS.spotMaxC}°C operating limit (SPOT user guide). SPOT skips this stop.`,
  };
  if (c > LIMITS.spotMaxC - 5) return {
    ...base, id: `heat-warn-${stop.id}-${actionId}`, level: "warning", title: "It's getting hot in here",
    detail: `${stop.name} is at ${c}°C. SPOT's limit is ${LIMITS.spotMaxC}°C (SPOT user guide).`,
  };
  return null;
}

/** Fires once when the dock is too hot for SPOT's charger. */
export function dockChargerAlert(dock: Stop, progress: number, intensityC: number): Alert | null {
  if (intensityC <= 0) return null;
  const c = round(ambientC(dock, progress, intensityC));
  if (c <= LIMITS.chargerMaxC) return null;
  return {
    id: `heat-dock-${dock.id}`, level: "warning", simulated: true, location_id: dock.id, action_id: null,
    title: "Dock too hot to charge",
    detail: `${dock.name} is at ${c}°C, above the charger's ${LIMITS.chargerMaxC}°C limit (SPOT user guide). SPOT can't recharge there until it cools down.`,
  };
}

const FAILURE_TEXT: Record<string, string> = {
  OBSTACLE_DETECTION: "Obstacle detected",
  PATH_BLOCKED: "Path blocked",
  LOCALIZATION_FAILURE: "SPOT lost its position",
  SENSOR_TIMEOUT: "Sensor timed out",
  READING_UNRELIABLE: "Unreliable reading",
  TARGET_NOT_DETECTED: "Target not found",
  COMMUNICATION_LOSS: "Connection lost",
  SIGNAL_NOISE: "Noisy signal",
};

/**
 * Alerts for one action once SPOT performs it: what the data says happened,
 * plus the heat wave's effect on temperature readings when it is on.
 * @param extraAirC how much hotter the air is than normal (heatWaveExtraC; 0 = no heat wave)
 */
export function actionAlerts(action: MissionAction, readings: MissionReading[], stop: Stop, extraAirC = 0): Alert[] {
  const out: Alert[] = [];
  const where = stop.name;
  const base = { location_id: action.location_id, action_id: action.action_id };

  if (action.status === "FAILED") {
    const what = FAILURE_TEXT[action.failure_type ?? ""] ?? "Step failed";
    out.push({ ...base, id: `fail-${action.action_id}`, level: "warning", simulated: false,
      title: `${what} at ${where}`,
      detail: `${action.action_type.replace(/_/g, " ").toLowerCase()} of ${action.asset_id} failed (${action.failure_type ?? "no reason given"}).` });
  }

  if (action.battery_pct !== null && action.battery_pct <= LIMITS.lowBatteryPct) {
    out.push({ ...base, id: `battery-${action.action_id}`, level: "warning", simulated: false,
      title: `Low battery: ${action.battery_pct}%`,
      detail: `SPOT is at ${action.battery_pct}% at ${where}. Warning below ${LIMITS.lowBatteryPct}% (our threshold).` });
  }

  for (const r of readings.filter(r => r.action_id === action.action_id)) {
    const id = `${r.reading_id}`;
    if (r.measurement_type === "TEMPERATURE_C") {
      const added = round(Math.max(0, extraAirC) * HEAT.equipmentGain);
      const c = round(r.value + added);
      const level: AlertLevel | null = c >= LIMITS.equipmentCriticalC ? "critical" : c >= LIMITS.equipmentWarnC ? "warning" : null;
      if (level) {
        const realLevel = r.value >= LIMITS.equipmentCriticalC ? "critical" : r.value >= LIMITS.equipmentWarnC ? "warning" : null;
        const simulated = level !== realLevel;
        const limit = level === "critical" ? LIMITS.equipmentCriticalC : LIMITS.equipmentWarnC;
        out.push({ ...base, id: `temp-${id}`, level, simulated,
          title: level === "critical" ? `Equipment overheating: ${r.asset_id}` : `Equipment running hot: ${r.asset_id}`,
          detail: simulated
            ? `${r.asset_id} at ${where} would be at ${c}°C (reading ${r.value}°C + ${added}°C from the heat wave). Above ${limit}°C (our threshold).`
            : `${r.asset_id} at ${where} read ${r.value}°C. Above ${limit}°C (our threshold; the data has no limits).` });
        continue;
      }
    }
    if (r.measurement_type === "LOCALIZATION_CONFIDENCE_PCT" && r.value < LIMITS.lowLocalizationPct) {
      out.push({ ...base, id: `loc-${id}`, level: "warning", simulated: false,
        title: `SPOT unsure of its position at ${where}`,
        detail: `Localization confidence ${r.value}%. Below ${LIMITS.lowLocalizationPct}% (our threshold), routes and readings here are less trustworthy.` });
      continue;
    }
    if (r.quality === "QUESTIONABLE") {
      out.push({ ...base, id: `q-${id}`, level: "info", simulated: false,
        title: `Questionable reading: ${r.asset_id}`,
        detail: `${r.measurement_type.replace(/_/g, " ").toLowerCase()} ${r.value} ${r.unit} at ${where} is marked QUESTIONABLE in the data.` });
    }
  }
  return out;
}

/** Obstacle at the dock (simulated): the alert SPOT raises when it sees it. */
export function dockObstacleAlert(dock: Stop, rerouted: boolean): Alert {
  return {
    id: `obstacle-${dock.id}`, level: rerouted ? "warning" : "critical", simulated: true,
    location_id: dock.id, action_id: null,
    title: `Obstacle in front of the ${dock.name}`,
    detail: rerouted
      ? `SPOT stopped, re-planned and went around it. Someone should clear it before SPOT needs to dock.`
      : `No other way in: SPOT can't reach ${dock.id}. An operator needs to clear it.`,
  };
}

// ------------------------------------------------------------------ obstacle geometry

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/**
 * Where to drop the simulated obstacle: a square of `size` px centred on the
 * route, `before` px before SPOT would arrive. That is "in front of" the stop,
 * whichever way SPOT approaches it, and never on the stop itself.
 */
export function obstacleOnApproach(leg: { x: number; y: number }[], before = 40, size = 36): Rect {
  let d = before;
  for (let i = leg.length - 1; i > 0; i--) {
    const a = leg[i - 1], b = leg[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg) {
      const t = seg ? d / seg : 0;
      const x = b.x + (a.x - b.x) * t, y = b.y + (a.y - b.y) * t;
      return { x0: x - size / 2, y0: y - size / 2, x1: x + size / 2, y1: y + size / 2 };
    }
    d -= seg;
  }
  const p = leg[0];
  return { x0: p.x - size / 2, y0: p.y - size / 2, x1: p.x + size / 2, y1: p.y + size / 2 };
}

/** Distance from a point to a rectangle (0 if inside). */
export function distToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
  return Math.hypot(dx, dy);
}
