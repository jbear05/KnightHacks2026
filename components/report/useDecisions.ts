"use client";

import { useRef, useState } from "react";
import { setDecision, USE_MOCK } from "@/lib/api";
import type { Decision, Problem } from "@/lib/types";

// Labels record a choice; none of them claims a technician was notified or the equipment fixed.
export const DECISIONS: { value: Decision; label: string; chosen: string }[] = [
  { value: "dispatch", label: "Dispatch a tech", chosen: "Dispatch recorded" },
  { value: "watch", label: "Watch", chosen: "Watch recorded" },
  { value: "dismiss", label: "Dismiss", chosen: "Dismissal recorded" },
];

/** Mock mode keeps decisions in this page only; say so instead of claiming a save. */
export const SAVED_NOTE = USE_MOCK
  ? "Mock mode: kept on this page only, not saved to a database, and lost on reload."
  : "Saved with this finding. This records your decision only; it does not notify a technician or mark the equipment fixed.";

export type DecisionMessage = { text: string; error: boolean } | null;

/**
 * Operator decisions with optimistic updates. Each problem tracks its own latest request:
 * a response (or failure) from an older request is ignored, so a slow save can never
 * overwrite a newer choice, and one row's save never unlocks another row.
 */
export function useDecisions(initial: Problem[]) {
  const [problems, setProblems] = useState(() => [...initial].sort((a, b) => b.priority - a.priority));
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [message, setMessage] = useState<DecisionMessage>(null);
  const latest = useRef(new Map<string, number>());
  const counter = useRef(0);
  // Last decision the server confirmed per problem: what a failed save rolls back to.
  const confirmed = useRef(new Map(initial.map((p) => [p.anomaly_id, p.decision] as const)));

  const patch = (id: string, decision: Decision | null) =>
    setProblems((ps) => ps.map((p) => (p.anomaly_id === id ? { ...p, decision } : p)));

  const setRowPending = (id: string, on: boolean) =>
    setPending((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function decide(problem: Problem, decision: Decision) {
    const id = problem.anomaly_id;
    const current = problems.find((p) => p.anomaly_id === id);
    if (current?.decision === decision) return;
    const request = ++counter.current;
    latest.current.set(id, request);
    patch(id, decision);
    setRowPending(id, true);
    const isLatest = () => latest.current.get(id) === request;

    try {
      const saved = await setDecision(problem, decision);
      // The server saved it even if a newer choice is in flight, so a later failure rolls back to this.
      confirmed.current.set(id, saved.decision);
      if (!isLatest()) return;
      patch(id, saved.decision);
      const label = DECISIONS.find((d) => d.value === saved.decision)?.chosen ?? "saved";
      setMessage({ text: `${problem.asset_id}: ${label.toLowerCase()}. ${SAVED_NOTE}`, error: false });
    } catch (e) {
      if (!isLatest()) return;
      patch(id, confirmed.current.get(id) ?? null);
      setMessage({
        text: `Couldn't save the decision for ${problem.asset_id}. ${e instanceof Error ? e.message : ""}`.trim(),
        error: true,
      });
    } finally {
      if (isLatest()) setRowPending(id, false);
    }
  }

  return { problems, pending, message, decide };
}
