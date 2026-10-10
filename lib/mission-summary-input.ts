import type { MissionDetail } from "./types";

const MAX_PROBLEM_EXAMPLES = 3;
const MAX_READING_EXAMPLES = 3;

function readable(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

export function buildMissionSummaryInput(mission: MissionDetail): string {
  const failedActions = mission.actions.filter((action) => action.status === "FAILED");
  const reviewRequired = mission.problems.filter((problem) => problem.operator_review_required).length;
  const problemExamples = mission.problems.slice(0, MAX_PROBLEM_EXAMPLES).map((problem) =>
    `${problem.severity} ${readable(problem.anomaly_type)} at ${problem.location} on ${problem.asset_id}${problem.operator_review_required ? "; operator review required" : ""}`,
  );
  const questionableReadings = mission.readings.filter((reading) => reading.quality === "QUESTIONABLE");
  const readingExamples = questionableReadings.slice(0, MAX_READING_EXAMPLES).map((reading) =>
    `${readable(reading.measurement_type)} ${reading.value} ${reading.unit} on ${reading.asset_id}`,
  );

  return `summarize: ${buildMissionFacts(mission, failedActions.length, reviewRequired, problemExamples, questionableReadings.length, readingExamples).join(" ")}`;
}

export function buildMissionRecordSummary(mission: MissionDetail): string {
  const failedActions = mission.actions.filter((action) => action.status === "FAILED");
  const reviewRequired = mission.problems.filter((problem) => problem.operator_review_required).length;
  const problemExamples = mission.problems.slice(0, MAX_PROBLEM_EXAMPLES).map((problem) =>
    `${problem.severity} ${readable(problem.anomaly_type)} at ${problem.location} on ${problem.asset_id}${problem.operator_review_required ? "; operator review required" : ""}`,
  );
  const questionableReadings = mission.readings.filter((reading) => reading.quality === "QUESTIONABLE");
  const readingExamples = questionableReadings.slice(0, MAX_READING_EXAMPLES).map((reading) =>
    `${readable(reading.measurement_type)} ${reading.value} ${reading.unit} on ${reading.asset_id}`,
  );

  return buildMissionFacts(mission, failedActions.length, reviewRequired, problemExamples, questionableReadings.length, readingExamples).join(" ");
}

function buildMissionFacts(
  mission: MissionDetail,
  failedActionCount: number,
  reviewRequired: number,
  problemExamples: string[],
  questionableReadingCount: number,
  readingExamples: string[],
): string[] {
  const facts = [
    `Mission ${mission.mission_id} (${mission.mission_name}) ended ${readable(mission.mission_status)} under ${readable(mission.scenario)} configuration ${mission.configuration_version}.`,
    `It had ${mission.actions.length} actions, of which ${failedActionCount} failed.`,
  ];

  if (mission.start_battery_pct !== null && mission.end_battery_pct !== null) {
    facts.push(`Battery changed from ${mission.start_battery_pct}% at start to ${mission.end_battery_pct}% at end.`);
  }

  facts.push(`${mission.problems.length} problems were recorded; ${reviewRequired} require operator review.`);
  if (problemExamples.length > 0) facts.push(`Recorded findings include ${problemExamples.join("; ")}.`);

  facts.push(`${questionableReadingCount} readings were marked questionable.`);
  if (readingExamples.length > 0) facts.push(`Examples include ${readingExamples.join("; ")}.`);

  return facts;
}