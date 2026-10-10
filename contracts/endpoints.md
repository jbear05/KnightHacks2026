# Watchdog API contract (proposed v2)

Status: **proposed by Jair (Design & Frontend), for the team to confirm in the first hour.**
Types live in [types.ts](types.ts) (copy to `lib/types.ts`). Checked on 2026-10-10 against `database/schema.sql`, all six NextEra CSVs and all 500 lines of `replay.ndjson`.

## Endpoints

| Endpoint | Returns | Notes |
|---|---|---|
| `GET /api/missions` | `MissionSummary[]` | Adds `hidden_problems` (warning tag) and `in_replay` (false for M024–M027). |
| `GET /api/missions/:id` | `MissionDetail` | `actions` by sequence, `problems` by priority desc, `readings` for the side panel, `summary` or null. |
| `GET /api/insights` | `Insights` | Every chart is a `RateStat` (total, succeeded, pct) so the UI can show "3 of 11". Adds `repeatAssets`. |
| `GET /api/assets/:id` | `AssetDetail` | `normal_bands` is `[]` until D3 is decided. Optional `actions` (the asset's steps, `SELECT * FROM actions WHERE asset_id = $1 ORDER BY timestamp`) lets Asset Detail explain failures; the page works without it. |
| `GET /api/locations` | `Location[]` | **New.** Map & Sim and `lib/format.ts` need waypoint names, floors and coords. |
| `GET /api/replay?mission=M014&speed=60&from=E00123` (SSE) | `LiveEvent` messages, then one `event: end` with `ReplayEnd` | `from` is optional (scrubbing). Only M001–M023 have events. |
| `POST /api/problems/:id/decision` | body `DecisionRequest` → updated `Problem` | `notes` optional; inserts a row in `operator_decisions`. |

Errors: any non-2xx returns `{ "error": "..." }` (404 for an unknown id, 400 for a bad decision).

## What changed from FRONTEND_PLAN.md section 3

1. **`LiveEvent` is typed per event type.** The JSON is unchanged; TypeScript now knows which `details` keys each event carries.
2. **`MISSION_COMPLETED` was missing fields.** It carries `end_battery_pct` (not `battery_pct`) and `status: "COMPLETED" | "FAILED"`. M017, the one failed mission, still emits `MISSION_COMPLETED` with `status: "FAILED"`, so the old `"SUCCESS" | "FAILED"` type was wrong.
3. **`scenario` / `configuration_version` only appear on `MISSION_STARTED`**, not on action events.
4. **`failure_type`:** `""` on success in the stream (as in the log), `null` in REST (as in Postgres). Full `FailureType` union added.
5. **`Problem` gained the raw IDs and context the screens need:** `action_id`, `timestamp`, `location_id`, `asset_id`, `anomaly_type`, `asset_criticality`, `operator_review_required`, `description`. Without `asset_id`/`location_id` the UI can't link to Asset Detail or light up a map pin; without `anomaly_type` it can't say what's wrong. Needs the view change below.
6. **`decision` is `Decision | null`** (null moved out of the `Decision` union, so the POST body can't send null).
7. **Added REST types:** `MissionSummary`, `MissionDetail`, `Action`, `Reading`, `AssetDetail`, `NormalBand`, `Insights`, `Location`, `Asset`, plus enum unions for every value in the data.

## Decisions the team needs to make

- **D1. How serious problems reach the live Attention Queue.** `replay.ndjson` has no anomaly events (from the "Live Mission panel ownership" thread).
  - **Recommended:** Backend injects a `PROBLEM_FOUND` event right after the matching action finishes. Already in `types.ts`.
  - Fallback: frontend fetches `GET /api/missions/:id` once and reveals each problem when its `action_id` finishes. Works with no backend change, since `Problem.action_id` is now included.
- **D2. One replay connection per page.** Recommended: Frontend's `ReplayProvider` owns the single `EventSource`; the map and replay controls read from it.
- **D3. Normal bands for Asset Detail charts.** The data has no thresholds. Either Data & AI defines a few (marked as our assumption in the footer), or the chart drops the shaded band and only marks questionable points. Default: drop the band.
- **D4. Localization readings.** 56 of 220 readings are `LOCALIZATION_CONFIDENCE_PCT` from NAVIGATION steps: robot telemetry, not equipment health. Default: Asset Detail hides them; Mission Report shows them on the walk steps.

## For Backend (no decision needed, just pitfalls)

- **Timestamps:** `pg` turns `TIMESTAMP` into a JS `Date`, which serializes as UTC with a `Z` and can shift the hour. Return the raw string: `types.setTypeParser(1114, s => s.replace(" ", "T"))`.
- **NUMERIC:** `pg` returns `NUMERIC` (`value`, `x_coord`, `y_coord`) as strings. Use `types.setTypeParser(1700, parseFloat)` or cast in SQL.
- **Anomaly location vs asset home:** 10 anomalies and 61 actions are at a different waypoint than the asset's home. The view uses the anomaly's own `location_id`, which is right for the map. Map & Sim should place SPOT by the action's `location_id`, not the asset's.

## `problems` view change (replaces the one in schema.sql)

```sql
CREATE OR REPLACE VIEW problems AS
SELECT
  an.anomaly_id,
  an.mission_id,
  an.action_id,
  an.timestamp,
  an.location_id,
  l.location_id || ' ' || l.location_name                  AS location,
  an.asset_id,
  a.asset_id || ' ' || a.asset_name                        AS asset,
  an.anomaly_type,
  an.severity,
  a.criticality                                            AS asset_criticality,
  (CASE an.severity    WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 ELSE 4 END) *
  (CASE a.criticality  WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 ELSE 4 END) AS priority,
  (m.mission_status = 'COMPLETED' AND an.severity IN ('HIGH','CRITICAL')) AS hidden_in_completed,
  an.operator_review_required,
  an.description,
  d.decision
FROM anomalies an
JOIN missions  m ON m.mission_id  = an.mission_id
JOIN assets    a ON a.asset_id    = an.asset_id
JOIN locations l ON l.location_id = an.location_id
LEFT JOIN LATERAL (
  SELECT decision FROM operator_decisions od
  WHERE od.anomaly_id = an.anomaly_id
  ORDER BY created_at DESC, id DESC LIMIT 1
) d ON true;
```

Postgres won't let `CREATE OR REPLACE VIEW` insert columns in the middle; on a fresh database just run schema.sql with this view, otherwise `DROP VIEW problems;` first. Tested on Postgres 16 with all NextEra CSVs loaded: 40 rows, 14 hidden, M014 gives AN002 (priority 12) and AN035 (priority 9).

## Sanity numbers (checked against the CSVs)

- M014: 3 failed steps, 2 HIGH problems (AN002 on HX-217, AN035 on PANEL-212), 22 replay events.
- `hidden_in_completed` is true for 14 problems. PANEL-212 has 5 problems.
- Replay and actions.csv agree on every action's success/failure.
