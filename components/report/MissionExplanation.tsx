"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { recordSummaryLines } from "@/lib/mission-summary-input";
import { summarizeMission } from "@/lib/mission-summarizer";
import { evidence } from "@/lib/report";
import type { MissionDetail } from "@/lib/types";

type Draft =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "model"; text: string }
  | { state: "rejected" }
  | { state: "failed"; reason: string };

// "What needs attention": the record-based summary (always shown, authoritative), an optional AI draft
// underneath it, and the evidence counts on the right.
export function MissionExplanation({ mission: m }: { mission: MissionDetail }) {
  const rows = evidence(m);
  const lines = recordSummaryLines(m);
  const [draft, setDraft] = useState<Draft>({ state: "idle" });

  useEffect(() => setDraft({ state: "idle" }), [m.mission_id]);

  async function generate() {
    setDraft({ state: "pending" });
    try {
      const result = await summarizeMission(m);
      setDraft(result.source === "model" ? { state: "model", text: result.text } : { state: "rejected" });
    } catch (cause) {
      setDraft({ state: "failed", reason: cause instanceof Error ? cause.message : "unknown error" });
    }
  }

  return (
    <section
      aria-labelledby="attention-heading"
      className="flex flex-col gap-6 bg-pollen-tint px-[26px] py-5 sticker xl:flex-row xl:gap-8"
    >
      <div className="flex flex-col gap-3 xl:w-[760px] xl:shrink-0">
        <div className="flex flex-col gap-0.5">
          <h2 id="attention-heading" className="type-heading-md">
            What needs attention
          </h2>
          <p className="text-fg-subtle type-label">Summary from the mission records</p>
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5 type-body" aria-label="Mission summary from the records">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-line-strong/20 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-fg-subtle type-label">Optional AI wording</p>
            <Button onClick={generate} disabled={draft.state === "pending"}>
              {draft.state === "pending" ? "Drafting..." : draft.state === "model" ? "Redraft with AI" : "Draft with AI"}
            </Button>
          </div>
          {draft.state === "model" && (
            <blockquote className="border-l-4 border-line-strong/40 pl-3 text-fg-muted type-body">{draft.text}</blockquote>
          )}
          <p className="text-fg-muted type-body-sm" aria-live="polite">
            {draft.state === "pending"
              ? "Loading Falconsai T5 in this browser and drafting. First use downloads the model."
              : draft.state === "model"
                ? "AI draft from this mission's records, generated in your browser. Its numbers and IDs all appear in the records, but that check cannot tell whether a number is attached to the right field, so the record summary above is the one to rely on."
                : draft.state === "rejected"
                  ? "The AI draft used a number or ID that isn't in this mission's records, so it was discarded. The record summary above is unchanged."
                  : draft.state === "failed"
                    ? `AI drafting failed (${draft.reason}). The record summary above is unchanged.`
                    : "Falconsai T5 runs on-device and only loads if you ask for a draft. The record summary above does not depend on it."}
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="flex min-w-0 flex-1 flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex min-h-6 items-start justify-between gap-4">
              <dt className="type-body-strong">{r.label}</dt>
              <dd className="text-fg-muted type-mono">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
