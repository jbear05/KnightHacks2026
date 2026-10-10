"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { setDecision } from "@/lib/api";
import { ANOMALY_LABEL, criticalityPhrase, locationLabel, timeOf } from "@/lib/format";
import type { Decision, Problem } from "@/lib/types";

const DECISIONS: { value: Decision; label: string; chosen: string }[] = [
  { value: "dispatch", label: "Send a tech", chosen: "Tech sent" },
  { value: "watch", label: "Watch", chosen: "Watching" },
  { value: "dismiss", label: "Dismiss", chosen: "Dismissed" },
];

// Problems ranked by priority (severity × asset criticality), each with Send a tech / Watch / Dismiss.
// Decisions update optimistically and roll back with a message if the save fails.
export function ProblemList({ problems: initial }: { problems: Problem[] }) {
  const [problems, setProblems] = useState(() => [...initial].sort((a, b) => b.priority - a.priority));
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function decide(problem: Problem, decision: Decision) {
    if (problem.decision === decision) return;
    const previous = problem.decision;
    const label = DECISIONS.find((d) => d.value === decision)!;
    setProblems((ps) => ps.map((p) => (p.anomaly_id === problem.anomaly_id ? { ...p, decision } : p)));
    setSaving(problem.anomaly_id);
    try {
      const saved = await setDecision(problem, decision);
      setProblems((ps) => ps.map((p) => (p.anomaly_id === saved.anomaly_id ? saved : p)));
      setMessage({ text: `${problem.asset_id}: ${label.chosen.toLowerCase()}. Saved with the mission.`, error: false });
    } catch (e) {
      setProblems((ps) => ps.map((p) => (p.anomaly_id === problem.anomaly_id ? { ...p, decision: previous } : p)));
      setMessage({
        text: `Couldn't save the decision for ${problem.asset_id}. ${e instanceof Error ? e.message : ""}`.trim(),
        error: true,
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-labelledby="problems-heading" className="flex flex-col gap-2 bg-surface px-5 py-6 sticker sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="problems-heading" className="type-heading-lg">
          Problems found
        </h2>
        {problems.length > 1 && <p className="text-fg-subtle type-label">sorted by priority</p>}
      </div>

      {problems.length === 0 ? (
        <p className="flex items-center gap-2 py-3 type-body-strong text-success">
          <CheckCircle2 size={20} aria-hidden /> No problems found on this mission
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {problems.map((p) => {
            return (
              <li
                key={p.anomaly_id}
                className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-line py-3 lg:flex-nowrap"
              >
                <div className="flex w-[70px] shrink-0 flex-col">
                  <span className="type-number-md">{p.priority}</span>
                  <span className="text-fg-subtle type-label">Priority</span>
                </div>
                <div className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1">
                  <h3 className="type-body-strong">
                    {ANOMALY_LABEL[p.anomaly_type]} ·{" "}
                    <Link
                      href={`/assets/${encodeURIComponent(p.asset_id)}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {p.asset_id}
                    </Link>
                  </h3>
                  <p className="text-fg-muted type-body-sm">
                    {locationLabel(p.location_id)} · {criticalityPhrase(p.asset_criticality)} · {timeOf(p.timestamp)}
                  </p>
                  {p.hidden_in_completed && <p className="text-high type-label">Hidden in a completed mission</p>}
                </div>
                <SeverityBadge severity={p.severity} />
                <div role="group" aria-label={`Decision for ${p.asset_id}`} className="flex flex-wrap gap-2">
                  {DECISIONS.map((d) => {
                    const chosen = p.decision === d.value;
                    return (
                      <Button
                        key={d.value}
                        aria-pressed={chosen}
                        disabled={saving === p.anomaly_id}
                        onClick={() => decide(p, d.value)}
                        // Keep the row from shifting when "Send a tech" becomes the shorter "Tech sent".
                        className={d.value === "dispatch" ? "min-w-[106px]" : ""}
                      >
                        {chosen ? d.chosen : d.label}
                      </Button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {problems.length > 0 && (
        <p className="text-fg-muted type-body-sm">
          Choose an action for each finding. The selected action is recorded with the mission.
        </p>
      )}
      {/* Successes are announced only; a failed save is also shown, since the choice was rolled back. */}
      <p role="status" aria-live="polite" className={message?.error ? "text-failed type-body-strong" : "sr-only"}>
        {message?.text}
      </p>
    </section>
  );
}
