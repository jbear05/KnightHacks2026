import Image from "next/image";
import type { BatteryBar } from "@/lib/insights";

// Column chart, % of steps ok per battery bucket, with the suggested "dock before 20%" zone shaded.
// Geometry follows the Figma chart (384 × 330): plot from y=40 (100%) to y=260 (0%).
const TOP = 40;
const PLOT = 220;
const LEFT = 40;
const STEP = 68;

export function BatteryChart({ bars }: { bars: BatteryBar[] }) {
  const below = bars.filter((b) => b.belowDock).length;
  return (
    <div className="w-full overflow-x-auto">
      <ul className="sr-only" aria-label="Share of steps that succeeded, by battery level when the step started">
        {bars.map((b) => (
          <li key={b.label}>
            {b.label} battery: {b.pct}% of steps ok ({b.stat.succeeded} of {b.stat.total})
          </li>
        ))}
      </ul>
      <div aria-hidden className="relative h-[330px] w-[384px]">
        {[0, 50, 100].map((g) => {
          const y = TOP + PLOT - (g / 100) * PLOT;
          return (
            <div key={g}>
              <div className={`absolute left-10 h-px w-[344px] ${g === 0 ? "bg-line-strong" : "bg-line"}`} style={{ top: y }} />
              <p className="absolute left-0 text-fg-subtle type-mono" style={{ top: y - 8 }}>
                {g}%
              </p>
            </div>
          );
        })}
        {below > 0 && (
          <>
            <div className="absolute bg-failed-tint" style={{ left: LEFT, top: TOP, width: below * STEP, height: PLOT }} />
            <Image
              src="/figma/threshold-dock-20.svg"
              alt=""
              width={3}
              height={230}
              className="absolute max-w-none"
              style={{ left: LEFT + below * STEP - 1.25, top: 30 }}
            />
            <p
              className="absolute flex items-center gap-1 rounded-pill border-[1.5px] border-failed bg-failed-tint px-2 py-0.5 text-failed type-badge whitespace-nowrap"
              style={{ left: LEFT + below * STEP + 8, top: 2 }}
            >
              <Image src="/figma/icon-alert-triangle-ink.svg" alt="" width={14} height={14} />
              Suggested: dock before 20%
            </p>
          </>
        )}
        {bars.map((b, n) => {
          const h = (b.pct / 100) * PLOT;
          const cx = LEFT + 14 + n * STEP + 20;
          return (
            <div key={b.label}>
              <div
                className={`absolute w-10 rounded-t-[10px] border-2 border-line-strong ${b.belowDock ? "bg-blight" : "bg-leaf"}`}
                style={{ left: cx - 20, top: TOP + PLOT - h, height: h }}
              />
              <p
                className={`absolute -translate-x-1/2 type-number-md whitespace-nowrap ${b.belowDock ? "text-failed" : "text-fg"}`}
                style={{ left: cx, top: TOP + PLOT - h - 30 }}
              >
                {b.pct}%
              </p>
              <p className="absolute top-[268px] -translate-x-1/2 type-mono whitespace-nowrap" style={{ left: cx }}>
                {b.label}
              </p>
              <p className="absolute top-[286px] -translate-x-1/2 text-fg-subtle type-body-sm whitespace-nowrap" style={{ left: cx }}>
                {b.stat.succeeded} of {b.stat.total}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
