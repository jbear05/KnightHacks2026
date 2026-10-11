// Mission index filters. Pure functions over GET /api/missions so they are easy to check.
import { dateOf } from "./format";
import type { ConfigVersion, MissionStatus, MissionSummary } from "./types";

export type Show = "all" | "issues" | "serious" | "awaiting" | "clean";
export type Sort = "newest" | "oldest" | "serious";

export interface MissionFilters {
  q: string;
  config: ConfigVersion | "all";
  status: MissionStatus | "all";
  show: Show;
  sort: Sort;
}

export const NO_FILTERS: MissionFilters = { q: "", config: "all", status: "all", show: "all", sort: "newest" };

export const SHOW_LABEL: Record<Show, string> = {
  all: "All missions",
  issues: "Failed steps or serious findings",
  serious: "Serious findings only",
  awaiting: "Findings awaiting review",
  clean: "No failed steps or serious findings",
};

/** Something an operator should look at: any failed step or any HIGH/CRITICAL finding. */
export const hasIssues = (m: MissionSummary) => m.failed_actions > 0 || m.serious_problems > 0;

/** A run SPOT called "completed" that still had failures or serious findings. */
export const completedWithIssues = (m: MissionSummary) => m.mission_status === "COMPLETED" && hasIssues(m);

export function filterMissions(missions: MissionSummary[], f: MissionFilters): MissionSummary[] {
  const q = f.q.trim().toLowerCase();
  const out = missions.filter((m) => {
    if (q && ![m.mission_id, m.mission_name, dateOf(m.start_time), m.start_time.slice(0, 10)].some((s) => s.toLowerCase().includes(q))) return false;
    if (f.config !== "all" && m.configuration_version !== f.config) return false;
    if (f.status !== "all" && m.mission_status !== f.status) return false;
    if (f.show === "issues" && !hasIssues(m)) return false;
    if (f.show === "serious" && m.serious_problems === 0) return false;
    if (f.show === "awaiting" && !(m.awaiting_review > 0)) return false;
    if (f.show === "clean" && hasIssues(m)) return false;
    return true;
  });
  const byTime = (a: MissionSummary, b: MissionSummary) => a.start_time.localeCompare(b.start_time) || a.mission_id.localeCompare(b.mission_id);
  if (f.sort === "oldest") return out.sort(byTime);
  if (f.sort === "serious") return out.sort((a, b) => b.serious_problems - a.serious_problems || b.failed_actions - a.failed_actions || byTime(a, b));
  return out.sort((a, b) => byTime(b, a));
}

/** "V2 · failed · search “m01”", for the empty-result message. */
export function describeFilters(f: MissionFilters): string {
  const parts: string[] = [];
  if (f.config !== "all") parts.push(f.config);
  if (f.status !== "all") parts.push(f.status === "FAILED" ? "failed" : "completed");
  if (f.show !== "all") parts.push(SHOW_LABEL[f.show].toLowerCase());
  if (f.q.trim()) parts.push(`search “${f.q.trim()}”`);
  return parts.join(" · ");
}

export const isFiltered = (f: MissionFilters) =>
  f.q.trim() !== "" || f.config !== "all" || f.status !== "all" || f.show !== "all";
