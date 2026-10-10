import Image from "next/image";
import { Glyph } from "@/components/ui/Glyph";

// Stand-in for Map & Sim's <FacilityMap mode="heatmap"> (contracts/facility-map-props.ts) until
// their module lands. Same inputs (heat per waypoint + heatLabel), so swapping it is one line.
// Pins are hand-placed on the Figma cartoon plan (744 × 404, Insights frame 11:144);
// locations.csv x/y do not match the drawing.
const PINS: Record<string, [number, number]> = {
  WP01: [73.38, 307.16],
  WP02: [76.79, 204.77],
  WP03: [171.5, 155.28],
  WP04: [145.9, 54.61],
  WP05: [303.74, 144.19],
  WP06: [375.41, 54.61],
  WP07: [450.5, 185.15],
  WP08: [256.82, 273.03],
  WP09: [373.71, 273.03],
  WP10: [456.47, 281.56],
  WP11: [576.77, 87.88],
  WP12: [679.16, 92.15],
  WP13: [568.24, 215.01],
  WP14: [673.18, 234.63],
  WP15: [608.34, 315.69],
};

const MAP_TOP = 20; // floor labels sit above the plan

/** Glow diameter grows 17px per finding (Figma: 1 → 43px, 8 → 162px). */
const glow = (n: number) => 26 + 17 * n;
const pinSize = (n: number) => (n >= 6 ? 30 : n >= 3 ? 22 : 12);
const countTone = (n: number) => (n >= 6 ? "text-failed" : n >= 3 ? "text-high" : "text-fg");

export interface FindingsHeatmapProps {
  heat: Partial<Record<string, number>>;
  heatLabel: (locationId: string, value: number) => string;
  hotspot?: { location_id: string; title: string; detail: string } | null;
}

export function FindingsHeatmap({ heat, heatLabel, hotspot }: FindingsHeatmapProps) {
  const stops = Object.entries(PINS).map(([id, [x, y]]) => ({ id, x, y: y + MAP_TOP, n: heat[id] ?? 0 }));
  const hot = hotspot ? stops.find((s) => s.id === hotspot.location_id) : undefined;

  return (
    <figure className="w-full overflow-x-auto">
      <div className="relative h-[430px] w-[744px]" aria-hidden>
        <p className="absolute top-0 left-[30px] type-heading-md">Floor 1</p>
        <p className="absolute top-0 left-[530px] type-heading-md">Floor 2</p>
        <Image
          src="/figma/insights-floor-plan.svg"
          alt=""
          width={744}
          height={405}
          className="absolute left-0 h-[404.42px] w-[744px] max-w-none"
          style={{ top: MAP_TOP }}
          priority
        />
        {stops
          .filter((s) => s.n > 0)
          .map((s) => (
            <span
              key={`glow-${s.id}`}
              className="absolute rounded-full"
              style={{
                left: s.x - glow(s.n) / 2,
                top: s.y - glow(s.n) / 2,
                width: glow(s.n),
                height: glow(s.n),
                background:
                  "radial-gradient(closest-side, rgb(198 238 69 / 0.95) 0%, rgb(198 238 69 / 0.55) 55%, rgb(198 238 69 / 0) 100%)",
              }}
            />
          ))}
        {stops.map((s) => {
          const size = pinSize(s.n);
          return (
            <span key={s.id} title={heatLabel(s.id, s.n)}>
              {s.n >= 3 ? (
                <Glyph name="blight" size={size} className="absolute" style={{ left: s.x - size / 2, top: s.y - size / 2 }} />
              ) : (
                <span
                  className="absolute size-3 rounded-full border-2 border-line-strong bg-surface"
                  style={{ left: s.x - 6, top: s.y - 6 }}
                />
              )}
              <span
                className="absolute flex gap-1 rounded-pill border border-line-strong bg-surface px-1.5 py-px whitespace-nowrap"
                style={{ left: s.x + size / 2 + 4, top: s.y - 10 }}
              >
                <span className="text-fg-muted type-mono">{s.id}</span>
                <span className={`font-mono text-[12px] leading-4 font-medium ${countTone(s.n)}`}>{s.n}</span>
              </span>
            </span>
          );
        })}
        {hot && hotspot && (
          <div
            className="absolute flex flex-col gap-0.5 rounded-[14px] border-2 border-line-strong bg-spot-tint px-3.5 py-2.5 whitespace-nowrap shadow-sticker"
            style={{ left: hot.x - 90, top: hot.y + 38 }}
          >
            <p className="type-body-strong">{hotspot.title}</p>
            <p className="text-fg-muted type-mono">{hotspot.detail}</p>
          </div>
        )}
      </div>
      {/* The drawing is decorative for screen readers; this list carries the same numbers. */}
      <figcaption className="sr-only">
        <ul>
          {stops.map((s) => (
            <li key={s.id}>{heatLabel(s.id, s.n)}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** Legend row under the map. */
export function HeatmapLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-fg-muted type-body-sm">
      <li className="flex items-center gap-2">
        <Image src="/figma/heat-glow-legend.svg" alt="" width={22} height={14} />
        Glow size = recorded findings at each stop
      </li>
      <li className="flex items-center gap-2">
        <Glyph name="blight" size={18} />
        3+ recorded findings
      </li>
      <li className="flex items-center gap-2">
        <span className="type-mono">WP09 6</span>
        stop · problem count
      </li>
    </ul>
  );
}
