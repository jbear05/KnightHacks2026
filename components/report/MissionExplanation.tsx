import { evidence } from "@/lib/report";
import type { MissionDetail } from "@/lib/types";

// "What needs attention": the AI summary from Data & AI, next to the numbers it is based on.
export function MissionExplanation({ mission: m }: { mission: MissionDetail }) {
  const rows = evidence(m);
  return (
    <section
      aria-labelledby="attention-heading"
      className="flex flex-col gap-6 bg-pollen-tint px-[26px] py-5 sticker xl:flex-row xl:gap-8"
    >
      <div className="flex flex-col gap-2 xl:w-[760px] xl:shrink-0">
        <h2 id="attention-heading" className="type-heading-md">
          What needs attention
        </h2>
        <p className="type-body">{m.summary ?? "The summary for this mission has not been generated yet."}</p>
        {m.summary && <p className="text-fg-muted type-body-sm">AI summary · generated from mission records</p>}
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
