"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/Glyph";
import { dateOf, timeOf, titleCase } from "@/lib/format";
import {
  completedWithIssues,
  describeFilters,
  filterMissions,
  isFiltered,
  NO_FILTERS,
  SHOW_LABEL,
  type MissionFilters,
  type Show,
  type Sort,
} from "@/lib/missions";
import type { MissionSummary } from "@/lib/types";

const SORT_LABEL: Record<Sort, string> = { newest: "Newest first", oldest: "Oldest first", serious: "Most serious findings" };

/** Filters live in the URL (?q=&config=&status=&show=&sort=) so Back from a report restores them. */
function toQuery(f: MissionFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && v !== NO_FILTERS[k as keyof MissionFilters]) p.set(k, String(v).trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function MissionIndex({ missions, initial }: { missions: MissionSummary[]; initial: MissionFilters }) {
  const [f, setF] = useState(initial);
  const shown = useMemo(() => filterMissions(missions, f), [missions, f]);
  const set = <K extends keyof MissionFilters>(k: K, v: MissionFilters[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const ids = useId();

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${toQuery(f)}`);
  }, [f]);

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        aria-label="Filter missions"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-wrap items-end gap-x-4 gap-y-3 bg-cream px-5 py-4 sticker"
      >
        <Field id={`${ids}-q`} label="Search">
          <input
            id={`${ids}-q`}
            type="search"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="M014, route name or date"
            className={`${control} w-[220px]`}
          />
        </Field>
        <Field id={`${ids}-config`} label="Configuration">
          <select id={`${ids}-config`} value={f.config} onChange={(e) => set("config", e.target.value as MissionFilters["config"])} className={control}>
            <option value="all">All</option>
            <option value="V1">Baseline V1</option>
            <option value="V2">Improved V2</option>
          </select>
        </Field>
        <Field id={`${ids}-status`} label="Mission status">
          <select id={`${ids}-status`} value={f.status} onChange={(e) => set("status", e.target.value as MissionFilters["status"])} className={control}>
            <option value="all">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </Field>
        <Field id={`${ids}-show`} label="Show">
          <select id={`${ids}-show`} value={f.show} onChange={(e) => set("show", e.target.value as Show)} className={control}>
            {(Object.keys(SHOW_LABEL) as Show[]).map((s) => (
              <option key={s} value={s}>
                {SHOW_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${ids}-sort`} label="Sort">
          <select id={`${ids}-sort`} value={f.sort} onChange={(e) => set("sort", e.target.value as Sort)} className={control}>
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        {isFiltered(f) && (
          <Button onClick={() => setF({ ...NO_FILTERS, sort: f.sort })} className="ml-auto">
            Clear filters
          </Button>
        )}
      </form>

      <p role="status" aria-live="polite" className="text-fg-muted type-body">
        Showing {shown.length} of {missions.length} missions
      </p>

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 bg-surface px-6 py-5 sticker">
          <p className="type-body-strong">No missions found for {describeFilters(f) || "these filters"}.</p>
          <p className="text-fg-muted type-body">
            Filters combine, so each one narrows the list. Clear them or loosen one to see more missions.
          </p>
          <Button onClick={() => setF({ ...NO_FILTERS, sort: f.sort })}>Clear filters</Button>
        </div>
      ) : (
        <div role="region" aria-label="Missions" tabIndex={0} className="relative overflow-x-auto bg-surface sticker">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">
              Missions, {SORT_LABEL[f.sort].toLowerCase()}. Completed missions with failed steps or serious findings are marked “with issues”.
            </caption>
            <thead>
              <tr className="border-b-2 border-line-strong text-fg-subtle type-label">
                <th scope="col" className="px-5 py-3 font-medium">Mission</th>
                <th scope="col" className="px-3 py-3 font-medium">Date</th>
                <th scope="col" className="px-3 py-3 font-medium">Configuration</th>
                <th scope="col" className="px-3 py-3 font-medium">Status</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Failed steps</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Serious findings</th>
                <th scope="col" className="px-5 py-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <MissionRow key={m.mission_id} m={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const control =
  "h-10 rounded-button border-2 border-line-strong bg-surface px-3 type-body text-fg focus-visible:outline-3 focus-visible:outline-line-strong";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-fg-subtle type-label">
        {label}
      </label>
      {children}
    </div>
  );
}

function MissionRow({ m }: { m: MissionSummary }) {
  const issues = completedWithIssues(m);
  const failed = m.mission_status === "FAILED";
  return (
    <tr className={`border-b border-line align-top ${issues && m.serious_problems > 0 ? "bg-high-tint/40" : ""}`}>
      <th scope="row" className="px-5 py-3 font-normal">
        <Link href={`/missions/${encodeURIComponent(m.mission_id)}`} className="type-body-strong underline-offset-2 hover:underline">
          {m.mission_id}
        </Link>
        <p className="text-fg-muted type-body-sm">{m.mission_name}</p>
      </th>
      <td className="px-3 py-3 type-mono whitespace-nowrap">
        {dateOf(m.start_time)}
        <p className="text-fg-subtle">
          {timeOf(m.start_time, false)}
          {m.end_time ? ` to ${timeOf(m.end_time, false)}` : ""}
        </p>
      </td>
      <td className="px-3 py-3 type-body whitespace-nowrap">
        {titleCase(m.scenario)} {m.configuration_version}
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-1.5 type-body-strong whitespace-nowrap">
          <Glyph name={failed || issues ? "blight" : "bloom"} size={18} />
          <span className={failed ? "text-failed" : ""}>{failed ? "Failed" : "Completed"}</span>
        </span>
        {issues && <p className="text-high type-label">with issues</p>}
      </td>
      <td className={`px-3 py-3 text-right type-number-md ${m.failed_actions ? "text-failed" : "text-fg-subtle"}`}>
        {m.failed_actions}
        <span className="sr-only"> failed steps</span>
      </td>
      <td className={`px-3 py-3 text-right type-number-md ${m.serious_problems ? "text-high" : "text-fg-subtle"}`}>{m.serious_problems}
        <span className="sr-only"> serious findings</span>
        {m.serious_problems > 0 && (
          <p className={`type-label ${m.awaiting_review > 0 ? "text-high" : "text-fg-subtle"}`}>
            {m.awaiting_review > 0 ? `${m.awaiting_review} awaiting review` : "all have decisions"}
          </p>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col gap-0.5 type-body-sm whitespace-nowrap">
          <Link href={`/missions/${encodeURIComponent(m.mission_id)}`} className="type-body-strong underline-offset-2 hover:underline" aria-label={`Report for ${m.mission_id}`}>
            Report →
          </Link>
          <Link href={`/live?mission=${encodeURIComponent(m.mission_id)}`} className="underline-offset-2 hover:underline" aria-label={`Replay ${m.mission_id}, reconstructed from mission records`}>
            Replay →
          </Link>
          {!m.in_replay && <span className="text-fg-subtle">no original replay log</span>}
        </div>
      </td>
    </tr>
  );
}
