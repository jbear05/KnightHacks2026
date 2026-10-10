import { Glyph } from "@/components/ui/Glyph";
import { compareSoWhat, pct } from "@/lib/insights";
import type { Insights, RateStat } from "@/lib/types";
import { SoWhat } from "./SoWhat";

// Baseline V1 vs Improved V2: step success and mission completion, side by side.
export function CompareBand({ insights: i }: { insights: Insights }) {
  const { V1, V2 } = i.compare;
  return (
    <section
      aria-labelledby="compare-heading"
      className="flex flex-col gap-6 bg-cream px-5 py-6 sticker sm:px-7 xl:flex-row xl:items-center"
    >
      <div className="flex flex-col gap-3 xl:w-[400px] xl:shrink-0">
        <h2 id="compare-heading" className="type-heading-lg">
          Baseline V1 vs Improved V2
        </h2>
        <SoWhat>{compareSoWhat(i)}</SoWhat>
        <p className="text-fg-subtle type-label">
          {V1.missions.total} V1 runs · {V2.missions.total} V2 runs
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6 md:flex-row">
        <CompareCard label="Step success" v1={V1.actions} v2={V2.actions} unit="steps" />
        <CompareCard label="Mission completion" v1={V1.missions} v2={V2.missions} unit="runs" />
      </div>
    </section>
  );
}

function CompareCard({ label, v1, v2, unit }: { label: string; v1: RateStat; v2: RateStat; unit: string }) {
  const a = pct(v1);
  const b = pct(v2);
  const better = b > a;
  const worse = b < a;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 bg-surface px-[22px] py-[18px] sticker">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-fg-subtle type-label">{label}</h3>
        {(better || worse) && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-pill border-[1.5px] px-2 py-0.5 whitespace-nowrap type-badge ${
              better ? "border-success bg-success-tint text-success" : "border-failed bg-failed-tint text-failed"
            }`}
          >
            <Glyph name={better ? "bloom" : "blight"} size={16} />
            {better ? "Better on V2" : "Worse on V2"}
          </span>
        )}
      </div>
      <p className="flex h-12 items-baseline gap-3 font-display font-bold whitespace-nowrap">
        <span className="type-number-xl text-fg-muted">
          <span className="sr-only">V1 </span>
          {a}%
        </span>
        <span aria-hidden className="text-[32px] text-fg-subtle">
          →
        </span>
        <span className={`type-number-xl ${better ? "text-success" : worse ? "text-failed" : "text-fg-muted"}`}>
          <span className="sr-only">V2 </span>
          {b}%
        </span>
      </p>
      <p className="text-fg-muted type-body-sm">
        {v1.succeeded} of {v1.total} {unit} on V1 → {v2.succeeded} of {v2.total} {unit} on V2
      </p>
    </div>
  );
}
