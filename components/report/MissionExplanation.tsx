"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { recordSummaryLines } from "@/lib/mission-summary-input";
import { isSummarizerCached, summarizeMission } from "@/lib/mission-summarizer";
import { evidence } from "@/lib/report";
import type { MissionDetail } from "@/lib/types";

type Draft =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "model"; text: string }
  | { state: "rejected" }
  | { state: "failed"; reason: string };

// Record IDs (WP06, HX-217, M014) and numbers with units, picked out in the draft so the eye lands on them.
const KEY_TERM = /(\b[A-Z]+-?\d+\b|\b\d+(?:\.\d+)?\s?(?:%|psi|dB|°C|min)?(?=[\s.,;:)]|$))/g;

function Emphasised({ text }: { text: string }) {
  return text.split(KEY_TERM).map((part, i) => (i % 2 ? <strong key={i} className="font-extrabold text-fg">{part}</strong> : part));
}

// "Mission brief": the AI draft leads the report, with the record-based summary (always shown,
// authoritative) and the evidence counts underneath to check it against.
export function MissionExplanation({ mission: m }: { mission: MissionDetail }) {
  const rows = evidence(m);
  const lines = recordSummaryLines(m);
  const [draft, setDraft] = useState<Draft>({ state: "idle" });

  async function generate() {
    setDraft({ state: "pending" });
    try {
      const result = await summarizeMission(m);
      setDraft(result.source === "model" ? { state: "model", text: result.text } : { state: "rejected" });
    } catch (cause) {
      setDraft({ state: "failed", reason: cause instanceof Error ? cause.message : "unknown error" });
    }
  }

  // New mission: start over, and draft straight away when the model is already downloaded.
  useEffect(() => {
    let live = true;
    setDraft({ state: "idle" });
    isSummarizerCached().then((cached) => {
      if (live && cached) generate();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.mission_id]);

  return (
    <section aria-labelledby="brief-heading" className="flex flex-col gap-5 bg-surface px-[26px] py-6 sticker">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full border-2 border-line-strong bg-spot">
            <Sparkles size={20} className="text-on-spot" />
          </span>
          <h2 id="brief-heading" className="type-heading-lg">
            Mission brief
          </h2>
          <span className="rounded-pill border-[1.5px] border-line-strong bg-spot-tint px-2.5 py-1 type-badge">
            AI draft · synthetic data
          </span>
        </div>
        <Button variant="primary" onClick={generate} disabled={draft.state === "pending"}>
          <Sparkles size={16} aria-hidden />
          {draft.state === "pending" ? "Drafting..." : draft.state === "model" ? "Redraft with AI" : "Draft with AI"}
        </Button>
      </div>

      <div className="rounded-[16px] border-2 border-line-strong bg-spot-tint px-6 py-5">
        {draft.state === "model" ? (
          <blockquote className="text-[18px] leading-[28px] text-fg sm:text-[21px] sm:leading-[32px]">
            <Emphasised text={draft.text} />
          </blockquote>
        ) : draft.state === "pending" ? (
          <div aria-hidden className="flex animate-pulse flex-col gap-3 py-1">
            <div className="h-5 w-11/12 rounded-full bg-line-strong/15" />
            <div className="h-5 w-4/5 rounded-full bg-line-strong/15" />
            <div className="h-5 w-3/5 rounded-full bg-line-strong/15" />
          </div>
        ) : (
          <p className="text-[18px] leading-[28px] text-fg-muted sm:text-[21px] sm:leading-[32px]">
            {draft.state === "rejected"
              ? "The draft mentioned a number or ID that isn't in this mission, so it was thrown away. Try a redraft, or read the records below."
              : draft.state === "failed"
                ? "The AI draft couldn't be made this time. The summary from the records is below."
                : "Get a plain-English brief of this mission, written on this device from its own records."}
          </p>
        )}
      </div>

      <p className="-mt-2 text-fg-muted type-body-sm" aria-live="polite">
        {draft.state === "pending"
          ? "Loading Falconsai T5 in this browser and drafting. First use downloads the model."
          : draft.state === "model"
            ? "AI draft from this mission's records, generated in your browser. Its numbers and IDs all appear in the records, but that check cannot tell whether a number is attached to the right field, so the record summary below is the one to rely on."
            : draft.state === "rejected"
              ? "The AI draft used a number or ID that isn't in this mission's records, so it was discarded. The record summary below is unchanged."
              : draft.state === "failed"
                ? `AI drafting failed (${draft.reason}). The record summary below is unchanged.`
                : "Falconsai T5 runs on-device and only loads if you ask for a draft. The record summary below does not depend on it."}
      </p>

      <div className="flex flex-col gap-6 border-t-2 border-dashed border-line-strong/25 pt-4 xl:flex-row xl:gap-8">
        <div className="flex flex-col gap-2 xl:w-[760px] xl:shrink-0">
          <p className="text-fg-subtle type-label">Check it against the records</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 type-body" aria-label="Mission summary from the records">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        {rows.length > 0 && (
          <dl className="flex min-w-0 flex-1 flex-col gap-2 xl:pt-7">
            {rows.map((r) => (
              <div key={r.label} className="flex min-h-6 items-start justify-between gap-4">
                <dt className="type-body-strong">{r.label}</dt>
                <dd className="text-fg-muted type-mono">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
