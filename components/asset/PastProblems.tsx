import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ReviewState } from "@/components/report/ReviewState";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { dayTime, problemContext } from "@/lib/asset";
import { ANOMALY_LABEL, locationLabel } from "@/lib/format";
import type { AssetDetail } from "@/lib/types";

// Every problem on this asset, by priority. Read-only: decisions are made on the mission report.
export function PastProblems({ asset: d }: { asset: AssetDetail }) {
  const problems = d.problems;
  return (
    <section
      aria-labelledby="past-problems-heading"
      className="flex min-w-0 flex-1 flex-col gap-2 bg-surface px-5 py-6 sticker sm:px-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="past-problems-heading" className="type-heading-lg">
          Past problems
        </h2>
        {problems.length > 0 && (
          <p className="text-fg-subtle type-label">
            {problems.length} found{problems.length > 1 ? " · sorted by priority" : ""}
          </p>
        )}
      </div>

      {problems.length === 0 ? (
        <p className="flex items-center gap-2 py-3 type-body-strong text-success">
          <CheckCircle2 size={20} aria-hidden /> No problems recorded on this asset
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {problems.map((p) => {
            const context = problemContext(d, p);
            return (
              <li
                key={p.anomaly_id}
                id={`problem-${p.anomaly_id}`}
                className="flex scroll-mt-24 items-start gap-4 border-b border-line py-3"
              >
                <div className="flex shrink-0 flex-col">
                  <span className="type-number-md">{p.priority}</span>
                  <span className="text-fg-subtle type-label">Priority</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="type-body-strong">
                    {ANOMALY_LABEL[p.anomaly_type]} ·{" "}
                    <Link
                      href={`/missions/${encodeURIComponent(p.mission_id)}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {p.mission_id}
                    </Link>
                  </h3>
                  <p className="text-fg-muted type-body-sm">
                    {locationLabel(p.location_id)} · {dayTime(p.timestamp)}
                    {context ? ` · ${context}` : ""}
                  </p>
                  {p.hidden_in_completed && <p className="text-high type-label">Hidden in a completed mission</p>}
                  <ReviewState problem={p} />
                </div>
                <SeverityBadge severity={p.severity} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
