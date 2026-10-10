// lib/types.ts — Watchdog shared data contracts
// Status: PROPOSED v2 (reconciled against database/schema.sql, NextEra's CSVs and replay.ndjson
// on 2026-10-10). Waiting on team confirmation. See contracts/endpoints.md for what changed
// from FRONTEND_PLAN.md section 3 and the open decisions.
//
// Rules:
// - Field names match the CSV / Postgres column names (snake_case) so Backend can return rows as-is.
// - Timestamps are ISO strings WITHOUT a timezone ("2026-09-01T18:03:06"), exactly as in the data.
//   Treat them as plant-local time. Never return JS Date objects from the API (see endpoints.md).
// - Numbers are numbers. Postgres NUMERIC comes back from `pg` as a string; Backend converts it.
// - Missing values are `null` in REST responses. The live stream keeps replay.ndjson's own shape,
//   where failure_type is "" on success.

// ───────────────────────────── Enums (every value seen in the data) ─────────────────────────────

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";   // anomaly severity
export type Criticality = Severity;                               // asset criticality, same scale
export type Scenario = "BASELINE" | "IMPROVED";
export type ConfigVersion = "V1" | "V2";                          // BASELINE = V1, IMPROVED = V2
export type MissionStatus = "COMPLETED" | "FAILED";               // only M017 is FAILED
export type ActionStatus = "SUCCESS" | "FAILED";

export type ActionType =
  | "NAVIGATION" | "VISUAL_INSPECTION" | "THERMAL_INSPECTION"
  | "ACOUSTIC_INSPECTION" | "GAUGE_READING";

export type FailureType =
  | "READING_UNRELIABLE" | "SENSOR_TIMEOUT" | "TARGET_NOT_DETECTED" | "LOCALIZATION_FAILURE"
  | "COMMUNICATION_LOSS" | "SIGNAL_NOISE" | "OBSTACLE_DETECTION" | "PATH_BLOCKED";

export type AnomalyType =
  | "ABNORMAL_VIBRATION" | "SIGNAL_DEGRADATION" | "GAUGE_OUT_OF_RANGE" | "VISUAL_DEFECT"
  | "ABNORMAL_TEMPERATURE" | "NAVIGATION_OBSTRUCTION" | "LOCALIZATION_ISSUE";

export type MeasurementType =
  | "TEMPERATURE_C" | "SOUND_DB" | "PRESSURE_PSI" | "VISUAL_SCORE"
  | "LOCALIZATION_CONFIDENCE_PCT";  // robot telemetry from NAVIGATION steps, not asset health
export type Unit = "C" | "dB" | "psi" | "score" | "pct";
export type ReadingQuality = "GOOD" | "QUESTIONABLE";

export type ZoneType = "ACCESS" | "ELECTRICAL" | "MECHANICAL" | "PROCESS";
export type Environment = "NORMAL" | "HIGH_NOISE" | "LOW_LIGHT" | "INDOOR_DRY" | "INDOOR_DUSTY";

export type Decision = "dispatch" | "watch" | "dismiss";

// Score mapping used by priority: LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4.
export const SEVERITY_SCORE: Record<Severity, 1 | 2 | 3 | 4> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// ───────────────────────────── 1. Live event (SSE /api/replay) ─────────────────────────────
// Same JSON as replay.ndjson lines, typed per event_type so `switch (e.event_type)` narrows `details`.
// Checked against all 500 lines: these are the exact keys each event type carries.

export type EventType =
  | "MISSION_STARTED" | "MISSION_COMPLETED"
  | "ACTION_STARTED" | "ACTION_COMPLETED" | "ACTION_FAILED"
  | "PROBLEM_FOUND";   // NOT in replay.ndjson; injected by Backend (decision D1 in endpoints.md)

interface LiveEventBase {
  event_id: string;    // "E00002"; PROBLEM_FOUND events use "P" + anomaly_id, e.g. "PAN002"
  mission_id: string;  // "M001"
  timestamp: string;   // "2026-09-01T18:03:06"
}

export type LiveEvent =
  | (LiveEventBase & {
      event_type: "MISSION_STARTED";
      details: { scenario: Scenario; configuration_version: ConfigVersion; battery_pct: number };
    })
  | (LiveEventBase & {
      event_type: "ACTION_STARTED";
      details: { action_id: string; location_id: string; asset_id: string; action_type: ActionType; battery_pct: number };
    })
  | (LiveEventBase & {
      event_type: "ACTION_COMPLETED";
      details: { action_id: string; status: "SUCCESS"; failure_type: "" };
    })
  | (LiveEventBase & {
      event_type: "ACTION_FAILED";
      details: { action_id: string; status: "FAILED"; failure_type: FailureType };
    })
  | (LiveEventBase & {
      // Named COMPLETED in the log even when the mission failed: M017 emits status "FAILED" here.
      event_type: "MISSION_COMPLETED";
      details: { status: MissionStatus; end_battery_pct: number };
    })
  | (LiveEventBase & {
      event_type: "PROBLEM_FOUND";   // sent right after the ACTION_COMPLETED/FAILED of details.action_id
      details: { action_id: string; problem: Problem };
    });

// Sent as a named SSE event (`event: end`) when the stream stops. replay.ndjson ends mid-action
// in M023 and has no events for M024–M027, so the UI needs to know why it stopped.
export interface ReplayEnd {
  mission_id: string;
  reason: "mission_finished" | "log_ends";   // log_ends -> "NextEra's event log ends here (23 of 27 missions included)."
}

// ───────────────────────────── 2. Problem (anomaly shown to the operator) ─────────────────────────────
// One row of the `problems` view. Fields marked NEW need the view change in endpoints.md.

export interface Problem {
  anomaly_id: string;            // "AN002"
  mission_id: string;            // "M014"
  action_id: string;             // NEW "A0133": links to the timeline step and the live stream
  timestamp: string;             // NEW
  location_id: string;           // NEW "WP06": for map pins and links (anomaly's own location, may differ from the asset's home)
  location: string;              // "WP06 Compressor Area" (display)
  asset_id: string;              // NEW "HX-217": for /assets/[id] links
  asset: string;                 // "HX-217 Heat Exchanger 17" (display)
  anomaly_type: AnomalyType;     // NEW: what is wrong ("Gauge out of range")
  severity: Severity;
  asset_criticality: Criticality;// NEW: lets the UI explain the score ("High x Critical = 12")
  priority: number;              // SEVERITY_SCORE[severity] * SEVERITY_SCORE[criticality], 1..16
  hidden_in_completed: boolean;  // mission COMPLETED and severity HIGH/CRITICAL (14 in the data)
  operator_review_required: boolean; // NEW, from the CSV (true for exactly the HIGH/CRITICAL rows)
  description: string | null;    // NEW, from the CSV (generic synthetic text)
  decision: Decision | null;     // latest operator decision, null if none yet
}

// ───────────────────────────── 3. Reference data ─────────────────────────────

export interface Location {
  location_id: string;   // "WP01".."WP15"
  location_name: string; // "Main Entrance"
  zone_type: ZoneType;
  floor: 1 | 2;
  x_coord: number;       // NextEra's synthetic coords; do NOT match fictional_floor_plan.png pins
  y_coord: number;
  environment: Environment;
}

export interface Asset {
  asset_id: string;      // "PANEL-212"
  asset_name: string;
  asset_type: string;    // "Heat Exchanger", "Electrical Panel", "Pump", ...
  location_id: string;   // home location
  criticality: Criticality;
}

// ───────────────────────────── 4. REST responses ─────────────────────────────

// GET /api/missions -> MissionSummary[]
export interface MissionSummary {
  mission_id: string;
  mission_name: string;
  scenario: Scenario;
  configuration_version: ConfigVersion;
  start_time: string;
  end_time: string | null;
  duration_min: number | null;
  start_battery_pct: number | null;
  end_battery_pct: number | null;
  mission_status: MissionStatus;
  failed_actions: number;       // count of actions with status FAILED
  serious_problems: number;     // count of HIGH/CRITICAL problems
  hidden_problems: number;      // count of problems with hidden_in_completed (drives the warning tag)
  awaiting_review: number;      // problems with operator_review_required and no saved decision (decision IS NULL)
  in_replay: boolean;           // false for M024–M027 (no live replay available)
}

export interface Action {
  action_id: string;
  mission_id: string;
  sequence: number;             // 1..10
  timestamp: string;
  location_id: string;          // where SPOT was; differs from the asset's home in 61 of 270 rows
  asset_id: string;
  action_type: ActionType;
  battery_pct: number | null;
  status: ActionStatus;
  failure_type: FailureType | null;
  duration_sec: number | null;
}

// GET /api/missions/:id -> MissionDetail
export interface MissionDetail extends MissionSummary {
  actions: Action[];            // sorted by sequence
  readings: Reading[];          // readings taken on this mission (timeline side panel)
  problems: Problem[];          // sorted by priority desc
  summary: string | null;       // AI text from Data & AI, null until generated
}

export interface Reading {
  reading_id: string;
  action_id: string;
  mission_id: string;
  asset_id: string;
  location_id: string;
  timestamp: string;
  measurement_type: MeasurementType;
  value: number;
  unit: Unit;
  quality: ReadingQuality;
}

export interface NormalBand {
  measurement_type: MeasurementType;
  min: number;
  max: number;
  source: string;               // who defined it, e.g. "Watchdog assumption" (the data has none; decision D3)
}

// GET /api/assets/:id -> AssetDetail
export interface AssetDetail extends Asset {
  location_name: string;
  readings: Reading[];          // sorted by timestamp; one chart per measurement_type
  problems: Problem[];
  normal_bands: NormalBand[];   // empty array if none defined
  actions?: Action[];           // optional: steps SPOT ran on this asset, sorted by timestamp. Lets the
                                // page explain a reading or problem ("gauge step timed out").
}

// GET /api/insights -> Insights
export interface RateStat { total: number; succeeded: number; pct: number }  // pct 0..100, one decimal

export interface Insights {
  compare: Record<ConfigVersion, {
    missions: RateStat;         // succeeded = COMPLETED. V1 94.4, V2 100
    actions: RateStat;          // succeeded = SUCCESS.   V1 77.2, V2 91.1
  }>;
  /** V1 vs V2 step success within each inspection type (same mix on both sides of the comparison). */
  byConfigType?: Array<{ action_type: ActionType } & Record<ConfigVersion, RateStat>>;
  byLocation: Array<{ location_id: string; location_name: string; actions: RateStat; problems: number; nav_failure_pct: number | null }>;
  batteryBuckets: Array<{ label: string; min: number; max: number; actions: RateStat }>; // e.g. "<20%", "20-40%", ...
  byActionType: Array<{ action_type: ActionType; actions: RateStat }>;
  failureCauses: Array<{ failure_type: FailureType; count: number }>;
  repeatAssets: Array<{ asset_id: string; asset_name: string; problems: number }>;
  soWhat: Partial<Record<"compare" | "byLocation" | "battery" | "byActionType" | "failureCauses" | "repeatAssets", string>>;
}

// POST /api/problems/:id/decision
export interface DecisionRequest { decision: Decision; notes?: string }
// -> Problem (with the new decision)

// Error body for any non-2xx response
export interface ApiError { error: string }
