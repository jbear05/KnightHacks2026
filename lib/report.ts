// Derived numbers for the Mission Report. Pure functions over MissionDetail so they are easy to check.
import { assetOf, floorOf, FAILURE_PLURAL, numberWord, plural, readingValue } from "./format";
import type { Action, FailureType, MissionDetail, Problem, Reading, Severity } from "./types";

export const SERIOUS: Severity[] = ["HIGH", "CRITICAL"];

export function readingFor(m: MissionDetail, actionId: string): Reading | undefined {
  // NAVIGATION steps only carry robot telemetry (decision D4); keep it, the step panel labels it.
  return m.readings.find((r) => r.action_id === actionId);
}

export function problemsFor(m: MissionDetail, actionId: string): Problem[] {
  return m.problems.filter((p) => p.action_id === actionId);
}

export function countBySeverity(problems: Problem[]): Record<Severity, number> {
  const out: Record<Severity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const p of problems) out[p.severity] += 1;
  return out;
}

export function floorChanges(actions: Action[]): number {
  let changes = 0;
  for (let i = 1; i < actions.length; i++) {
    const a = floorOf(actions[i - 1].location_id);
    const b = floorOf(actions[i].location_id);
    if (a && b && a !== b) changes += 1;
  }
  return changes;
}

/** Hero sentence under the headline. */
export function heroSentence(m: MissionDetail): string {
  const total = m.actions.length;
  const ok = total - m.failed_actions;
  const serious = m.problems.filter((p) => SERIOUS.includes(p.severity));
  let s = `${m.mission_id} finished with ${ok} of ${total} steps succeeding.`;
  if (serious.length === 0) return `${s} No serious equipment findings.`;
  const top = serious.some((p) => p.severity === "CRITICAL") ? "critical" : "high-severity";
  s += ` ${numberWord(serious.length)} ${top} equipment ${serious.length === 1 ? "finding needs" : "findings need"} review`;
  const onCritical = serious.find((p) => p.asset_criticality === "CRITICAL");
  const type = onCritical ? assetOf(onCritical.asset_id)?.asset_type : undefined;
  if (onCritical && type) s += `, including one on a critical ${type.toLowerCase()}`;
  return `${s}.`;
}

export interface Evidence {
  label: string;
  value: string;
}

/** Right-hand list in "What needs attention": failure causes, then questionable readings behind problems. */
export function evidence(m: MissionDetail): Evidence[] {
  const byCause = new Map<FailureType, number>();
  for (const a of m.actions) if (a.failure_type) byCause.set(a.failure_type, (byCause.get(a.failure_type) ?? 0) + 1);
  const rows: Evidence[] = [...byCause.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cause, n]) => ({ label: FAILURE_PLURAL[cause], value: plural(n, "step") }));
  for (const p of m.problems) {
    const r = readingFor(m, p.action_id);
    if (r?.quality === "QUESTIONABLE") rows.push({ label: `${p.asset_id} reading quality`, value: "Questionable" });
  }
  return rows;
}

export function headlineReading(r: Reading | undefined): string {
  return r ? readingValue(r) : "No reading";
}
