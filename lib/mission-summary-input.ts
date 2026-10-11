import { ACTION_LABEL, ANOMALY_LABEL, dateOf, FAILURE_LABEL, plural, readingValue, SEVERITY_LABEL, titleCase } from "./format";
import { SERIOUS } from "./report";
import type { MissionDetail } from "./types";

const MAX_PROBLEM_EXAMPLES = 3;
const MAX_READING_EXAMPLES = 3;

function readable(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

/**
 * Model input, most important facts first: T5 summaries lean on the opening sentences, so the outcome,
 * the failed steps and the most urgent findings lead, and battery and readings come last.
 */
export function buildMissionSummaryInput(mission: MissionDetail): string {
  const failedActions = [...mission.actions].sort((a, b) => a.sequence - b.sequence).filter((action) => action.status === "FAILED");
  const failedSteps = failedActions.map((action) =>
    `${ACTION_LABEL[action.action_type].toLowerCase()} at ${action.location_id}${action.failure_type ? ` (${FAILURE_LABEL[action.failure_type].toLowerCase()})` : ""}`,
  );
  const reviewRequired = mission.problems.filter((problem) => problem.operator_review_required).length;
  const problemExamples = [...mission.problems].sort((a, b) => b.priority - a.priority).slice(0, MAX_PROBLEM_EXAMPLES).map((problem) =>
    `${problem.severity} ${readable(problem.anomaly_type)} at ${problem.location} on ${problem.asset_id}${problem.operator_review_required ? "; operator review required" : ""}`,
  );
  const questionableReadings = mission.readings.filter((reading) => reading.quality === "QUESTIONABLE");
  const readingExamples = questionableReadings.slice(0, MAX_READING_EXAMPLES).map((reading) =>
    `${readable(reading.measurement_type)} ${reading.value} ${reading.unit} on ${reading.asset_id}`,
  );

  return `summarize: ${buildMissionFacts(mission, failedActions.length, failedSteps, reviewRequired, problemExamples, questionableReadings.length, readingExamples).join(" ")}`;
}

/**
 * The authoritative mission summary: plain sentences built only from the selected mission's records,
 * with every failed step and serious finding named. Shown on every report, before and regardless of
 * any AI wording, and never replaced by it.
 */
export function recordSummaryLines(m: MissionDetail): string[] {
  const steps = [...m.actions].sort((a, b) => a.sequence - b.sequence);
  const failed = steps.filter((a) => a.status === "FAILED");
  const serious = m.problems.filter((p) => SERIOUS.includes(p.severity)).sort((a, b) => b.priority - a.priority);
  const minor = m.problems.length - serious.length;
  const questionable = m.readings.filter((r) => r.quality === "QUESTIONABLE");
  // Robot telemetry from NAVIGATION steps is not an equipment-health reading (decision D4).
  const equipment = questionable.filter((r) => r.measurement_type !== "LOCALIZATION_CONFIDENCE_PCT");
  const telemetry = questionable.length - equipment.length;

  const status = m.mission_status === "COMPLETED" ? "completed its route" : "failed before finishing its route";
  let first = `${m.mission_id} ${status} (${titleCase(m.scenario)} ${m.configuration_version}, ${dateOf(m.start_time)}).`;
  if (m.start_battery_pct !== null && m.end_battery_pct !== null) first += ` Battery went from ${m.start_battery_pct}% to ${m.end_battery_pct}%.`;

  const failedLine =
    failed.length === 0
      ? `All ${plural(steps.length, "step")} succeeded.`
      : `${failed.length} of ${steps.length} steps failed: ${failed
          .map((a) => `step ${a.sequence} ${ACTION_LABEL[a.action_type].toLowerCase()} at ${a.location_id} (${a.failure_type ? FAILURE_LABEL[a.failure_type].toLowerCase() : "no cause recorded"})`)
          .join("; ")}.`;

  const seriousLine =
    serious.length === 0
      ? `No high or critical findings${minor ? `; ${plural(minor, "lower-severity finding")} recorded` : ""}.`
      : `${plural(serious.length, "serious finding")} recorded: ${serious
          .map((p) => `${SEVERITY_LABEL[p.severity].toLowerCase()} ${ANOMALY_LABEL[p.anomaly_type].toLowerCase()} on ${p.asset_id} at ${p.location_id} (priority ${p.priority})`)
          .join("; ")}${minor ? `, plus ${plural(minor, "lower-severity finding")}` : ""}.`;

  const parts = [
    equipment.length ? `${plural(equipment.length, "equipment reading")} (${equipment.map((r) => `${r.asset_id} ${readingValue(r)}`).join(", ")})` : "",
    telemetry ? `${plural(telemetry, "robot localization reading")} (navigation telemetry, not equipment health)` : "",
  ].filter(Boolean);
  const readingLine = parts.length ? `Questionable: ${parts.join(" and ")}. A questionable reading is not an equipment diagnosis.` : "No readings were marked questionable.";

  return [first, failedLine, seriousLine, readingLine];
}

export function buildMissionRecordSummary(mission: MissionDetail): string {
  return recordSummaryLines(mission).join(" ");
}

function buildMissionFacts(
  mission: MissionDetail,
  failedActionCount: number,
  failedSteps: string[],
  reviewRequired: number,
  problemExamples: string[],
  questionableReadingCount: number,
  readingExamples: string[],
): string[] {
  const facts = [
    `Mission ${mission.mission_id} (${mission.mission_name}) ended ${readable(mission.mission_status)} under ${readable(mission.scenario)} configuration ${mission.configuration_version}.`,
    `It had ${mission.actions.length} actions, of which ${failedActionCount} failed.`,
  ];
  if (failedSteps.length > 0) facts.push(`The failed steps were ${failedSteps.join("; ")}.`);

  facts.push(`${mission.problems.length} problems were recorded; ${reviewRequired} require operator review.`);
  if (problemExamples.length > 0) facts.push(`The most urgent findings are ${problemExamples.join("; ")}.`);

  if (mission.start_battery_pct !== null && mission.end_battery_pct !== null) {
    facts.push(`Battery changed from ${mission.start_battery_pct}% at start to ${mission.end_battery_pct}% at end.`);
  }

  facts.push(`${questionableReadingCount} readings were marked questionable.`);
  if (readingExamples.length > 0) facts.push(`Examples include ${readingExamples.join("; ")}.`);

  return facts;
}