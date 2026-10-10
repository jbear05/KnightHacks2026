// Builds lib/mock/insights.json (GET /api/insights) and lib/mock/missions.json (GET /api/missions)
// from the challenge kit CSVs, using the same rules as backend/src/routes/insights.js.
// Usage: node scripts/build-insights-mock.mjs "<kit>/02_DATA"
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/build-insights-mock.mjs "<kit>/02_DATA"');
  process.exit(1);
}

function csv(name) {
  const [head, ...rows] = readFileSync(join(dir, `${name}.csv`), "utf8").trim().split(/\r?\n/);
  const keys = head.split(",");
  return rows.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i], v])));
}

const num = (v) => (v === "" || v == null ? null : Number(v));
const rate = (items, ok) => {
  const total = items.length;
  const succeeded = items.filter(ok).length;
  return { total, succeeded, pct: total === 0 ? 0 : Math.round((succeeded / total) * 1000) / 10 };
};

const missions = csv("missions");
const actions = csv("actions").map((a) => ({ ...a, battery_pct: num(a.battery_pct) }));
const anomalies = csv("anomalies");
const locations = csv("locations");
const assets = csv("assets");
const statusOf = Object.fromEntries(missions.map((m) => [m.mission_id, m.mission_status]));
const SERIOUS = ["HIGH", "CRITICAL"];

const compare = {};
for (const v of ["V1", "V2"]) {
  compare[v] = {
    missions: rate(missions.filter((m) => m.configuration_version === v), (m) => m.mission_status === "COMPLETED"),
    actions: rate(actions.filter((a) => a.configuration_version === v), (a) => a.status === "SUCCESS"),
  };
}

const byLocation = locations.map((l) => {
  const here = actions.filter((a) => a.location_id === l.location_id);
  const nav = here.filter((a) => a.action_type === "NAVIGATION");
  return {
    location_id: l.location_id,
    location_name: l.location_name,
    actions: rate(here, (a) => a.status === "SUCCESS"),
    problems: anomalies.filter((p) => p.location_id === l.location_id).length,
    nav_failure_pct: nav.length === 0 ? null : Math.round((nav.filter((a) => a.status === "FAILED").length / nav.length) * 1000) / 10,
  };
});

const batteryBuckets = [
  { label: "<20%", min: 0, max: 19 },
  { label: "20-40%", min: 20, max: 39 },
  { label: "40-60%", min: 40, max: 59 },
  { label: "60-80%", min: 60, max: 79 },
  { label: "80-100%", min: 80, max: 100 },
].map((b) => ({
  ...b,
  actions: rate(actions.filter((a) => a.battery_pct !== null && a.battery_pct >= b.min && a.battery_pct <= b.max), (a) => a.status === "SUCCESS"),
}));

const byActionType = ["NAVIGATION", "VISUAL_INSPECTION", "THERMAL_INSPECTION", "ACOUSTIC_INSPECTION", "GAUGE_READING"].map((t) => ({
  action_type: t,
  actions: rate(actions.filter((a) => a.action_type === t), (a) => a.status === "SUCCESS"),
}));

const causes = new Map();
for (const a of actions) if (a.status === "FAILED" && a.failure_type) causes.set(a.failure_type, (causes.get(a.failure_type) ?? 0) + 1);
const failureCauses = [...causes.entries()].map(([failure_type, count]) => ({ failure_type, count })).sort((a, b) => b.count - a.count);

const repeatAssets = assets
  .map((a) => ({ asset_id: a.asset_id, asset_name: a.asset_name, problems: anomalies.filter((p) => p.asset_id === a.asset_id).length }))
  .filter((a) => a.problems > 1)
  .sort((a, b) => b.problems - a.problems);

const insights = { compare, byLocation, batteryBuckets, byActionType, failureCauses, repeatAssets, soWhat: {} };

const replayIds = new Set(
  readFileSync(join(dir, "replay.ndjson"), "utf8").trim().split(/\r?\n/).map((l) => JSON.parse(l).mission_id),
);
const summaries = missions.map((m) => {
  const mine = anomalies.filter((p) => p.mission_id === m.mission_id);
  const serious = mine.filter((p) => SERIOUS.includes(p.severity));
  return {
    mission_id: m.mission_id,
    mission_name: m.mission_name,
    scenario: m.scenario,
    configuration_version: m.configuration_version,
    start_time: m.start_time,
    end_time: m.end_time || null,
    duration_min: num(m.duration_min),
    start_battery_pct: num(m.start_battery_pct),
    end_battery_pct: num(m.end_battery_pct),
    mission_status: m.mission_status,
    failed_actions: actions.filter((a) => a.mission_id === m.mission_id && a.status === "FAILED").length,
    serious_problems: serious.length,
    hidden_problems: statusOf[m.mission_id] === "COMPLETED" ? serious.length : 0,
    // Fixtures carry no operator decisions, so every flagged finding is awaiting review.
    awaiting_review: mine.filter((p) => p.operator_review_required.toLowerCase() === "true").length,
    in_replay: replayIds.has(m.mission_id),
  };
});

writeFileSync(new URL("../lib/mock/insights.json", import.meta.url), JSON.stringify(insights, null, 2) + "\n");
writeFileSync(new URL("../lib/mock/missions.json", import.meta.url), JSON.stringify(summaries, null, 2) + "\n");
console.log(`insights.json + missions.json written (${summaries.length} missions)`);
