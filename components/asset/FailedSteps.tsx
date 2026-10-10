import Link from "next/link";
import { dayTime, failedSteps, stepPhrase } from "@/lib/asset";
import { readingValue } from "@/lib/format";
import type { AssetDetail } from "@/lib/types";

// Steps on this asset that failed, from the optional actions list. Explains failures that left no
// reading, and keeps robot walk failures apart from equipment inspections.
export function FailedSteps({ asset: d }: { asset: AssetDetail }) {
  const rows = failedSteps(d);
  if (rows === null) return null; // API without the optional actions list
  return (
    <section aria-labelledby="failed-steps-heading" className="flex min-w-0 flex-col gap-2 bg-surface px-5 py-6 sticker sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="failed-steps-heading" className="type-heading-lg">
          Failed steps
        </h2>
        <p className="text-fg-subtle type-label">
          {rows.length} of {d.actions!.length} steps on this asset
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-fg-muted type-body">No step on this asset failed.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map(({ action: a, reading, walk, away }) => (
            <li key={a.action_id} className="flex flex-col gap-0.5 border-b border-line py-2.5">
              <p className="type-body-strong">
                {stepPhrase(a)} ·{" "}
                <Link href={`/missions/${encodeURIComponent(a.mission_id)}`} className="underline-offset-2 hover:underline">
                  {a.mission_id}
                </Link>{" "}
                step {a.sequence}
              </p>
              <p className="text-fg-muted type-body-sm">
                {dayTime(a.timestamp)} · {a.location_id}
                {away ? " (away from its home stop)" : ""} ·{" "}
                {walk
                  ? "robot navigation, not an equipment check"
                  : reading
                    ? `reading kept: ${readingValue(reading)}${reading.quality === "QUESTIONABLE" ? " (questionable)" : ""}`
                    : "no reading recorded"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
