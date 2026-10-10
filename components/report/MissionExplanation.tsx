"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { evidence } from "@/lib/report";
import { summarizeMission } from "@/lib/mission-summarizer";
import type { MissionDetail } from "@/lib/types";

// "What needs attention": the AI summary from Data & AI, next to the numbers it is based on.
export function MissionExplanation({ mission: m }: { mission: MissionDetail }) {
  const rows = evidence(m);
  const [summary, setSummary] = useState(m.summary);
  const [summarySource, setSummarySource] = useState<"fixture" | "model" | "records" | null>(m.summary ? "fixture" : null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(m.summary);
    setSummarySource(m.summary ? "fixture" : null);
    setPending(false);
    setError(null);
  }, [m.mission_id, m.summary]);

  async function generateSummary() {
    setPending(true);
    setError(null);
    try {
      const result = await summarizeMission(m);
      setSummary(result.text);
      setSummarySource(result.source);
      setError(result.source === "records" ? "The model added a number or identifier not in the mission records. Showing a record-based summary instead." : null);
    } catch (cause) {
      setError(cause instanceof Error ? `Summary generation failed: ${cause.message}` : "Summary generation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="attention-heading"
      className="flex flex-col gap-6 bg-pollen-tint px-[26px] py-5 sticker xl:flex-row xl:gap-8"
    >
      <div className="flex flex-col gap-2 xl:w-[760px] xl:shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="attention-heading" className="type-heading-md">
            What needs attention
          </h2>
          <Button onClick={generateSummary} disabled={pending}>
            {pending ? "Summarizing..." : summarySource ? "Regenerate summary" : "Generate summary"}
          </Button>
        </div>
        <p className="type-body">{summary ?? "No summary is available for this mission."}</p>
        <p className="text-fg-muted type-body-sm" aria-live="polite">
          {pending
            ? "Loading Falconsai T5 and summarizing. First use downloads the model to this browser."
            : summarySource === "model"
              ? "Generated in your browser from this mission's records. Verify against the evidence."
              : summarySource === "records"
                ? "Record-based summary. Model output did not pass the data check."
              : summary
                ? "Recorded mock summary. Generate a fresh on-device summary from the mission records."
                : "Falconsai T5 runs on-device; the model loads when you generate a summary."}
        </p>
        {error && <p role="status" className="text-fg-muted type-body-sm">{error}</p>}
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
