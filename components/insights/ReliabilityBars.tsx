import { Glyph } from "@/components/ui/Glyph";
import type { TypeBar } from "@/lib/insights";

// Pill progress bars, % of steps ok per inspection type. Weak types turn lime with a blight glyph.
export function ReliabilityBars({ bars }: { bars: TypeBar[] }) {
  return (
    <ul className="flex w-full flex-col gap-3.5 pt-1.5">
      {bars.map((b) => (
        <li key={b.action_type} className="flex items-center gap-3">
          <Glyph name={b.weak ? "blight" : "bloom"} size={20} className="shrink-0" />
          <span className="w-[110px] shrink-0 type-body-strong">{b.label}</span>
          <span
            role="meter"
            aria-label={`${b.label} steps ok`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={b.pct}
            className="relative h-[22px] w-[280px] min-w-0 shrink overflow-hidden rounded-pill border-[1.5px] border-line-strong bg-canvas"
          >
            <span
              className={`absolute -top-[1.5px] -left-[1.5px] h-[22px] rounded-pill ${b.weak ? "bg-blight" : "bg-leaf"}`}
              style={{ width: `${b.pct}%` }}
            />
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className={`type-number-md ${b.weak ? "text-failed" : "text-fg"}`}>{b.pct}%</span>
            <span className="text-fg-subtle type-mono">
              {b.stat.succeeded}/{b.stat.total}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
