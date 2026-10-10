"use client";

import { useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Glyph } from "@/components/ui/Glyph";
import {
  actionFor,
  assetNoun,
  axisFor,
  dayLabel,
  dayRange,
  dayTime,
  equipmentReadings,
  isSerious,
  labelSide,
  laneRows,
  MEASUREMENT,
  rangeLabel,
  splitSeries,
  stepPhrase,
  xFrac,
  type Series,
} from "@/lib/asset";
import { ANOMALY_LABEL, readingValue, SEVERITY_LABEL } from "@/lib/format";
import type { AssetDetail, Problem, Reading } from "@/lib/types";

type Range = NonNullable<ReturnType<typeof dayRange>>;

// Plot geometry from the Figma frame: 56px for y labels on the left, 16px gutter on the right,
// 40px for the title above, 12px below. Inner plot height is fixed; width follows the card.
const PAD_L = 56;
const PAD_R = 16;
const TOP = 40;
const PLOT_H = 148;

/** CSS left for a 0..1 position on the shared time axis. */
const xCss = (f: number) => `calc(${PAD_L}px + (100% - ${PAD_L + PAD_R}px) * ${f})`;

function tooltipText(d: AssetDetail, r: Reading): string {
  const a = actionFor(d, r.action_id);
  const why = a && a.status === "FAILED" ? `, ${stepPhrase(a)}` : "";
  return `${dayTime(r.timestamp)} · ${readingValue(r)}${why}`;
}

function DayGrid({ range, height, top }: { range: Range; height: number; top: number }) {
  return (
    <>
      {Array.from({ length: range.days + 1 }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute w-px bg-line"
          style={{ left: xCss(i / range.days), top, height }}
        />
      ))}
    </>
  );
}

function ProblemLines({ problems, range }: { problems: Problem[]; range: Range }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute overflow-visible"
      style={{ left: PAD_L, top: TOP, width: `calc(100% - ${PAD_L + PAD_R}px)`, height: PLOT_H }}
      viewBox={`0 0 100 ${PLOT_H}`}
      preserveAspectRatio="none"
    >
      {problems.filter(isSerious).map((p) => {
        const x = xFrac(p.timestamp, range) * 100;
        return (
          <line
            key={p.anomaly_id}
            x1={x}
            x2={x}
            y1={0}
            y2={PLOT_H}
            stroke="var(--color-failed)"
            strokeOpacity={0.5}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

function Chart({
  asset,
  series,
  range,
  active,
  onActive,
}: {
  asset: AssetDetail;
  series: Series;
  range: Range;
  active: string | null;
  onActive: (id: string | null) => void;
}) {
  const m = MEASUREMENT[series.type];
  const rs = series.readings;
  const axis = axisFor(rs.map((r) => r.value));
  const band = asset.normal_bands.find((b) => b.measurement_type === series.type);
  const yOf = (v: number) => TOP + (1 - (v - axis.min) / (axis.max - axis.min)) * PLOT_H;
  const points = rs.map((r) => ({ r, f: xFrac(r.timestamp, range), y: yOf(r.value) }));
  const titleId = `chart-${series.type}`;

  return (
    <div role="group" aria-labelledby={titleId} className="relative h-[200px] w-full">
      <p id={titleId} className="absolute top-0 left-0 flex items-baseline gap-2 whitespace-nowrap">
        <span className="type-body-strong">{m.name}</span>
        <span className="text-fg-muted type-body-sm">
          {m.scale} · {rs.length} {m.noun[rs.length === 1 ? 0 : 1]}
        </span>
      </p>

      <DayGrid range={range} top={TOP} height={PLOT_H} />
      {band && (
        <div
          aria-hidden
          className="absolute bg-success-tint/60"
          style={{
            left: PAD_L,
            right: PAD_R,
            top: yOf(Math.min(band.max, axis.max)),
            height: yOf(Math.max(band.min, axis.min)) - yOf(Math.min(band.max, axis.max)),
          }}
        />
      )}
      {axis.ticks.map((t, i) => (
        <div key={t} aria-hidden>
          <div
            className={`absolute h-px ${i === 0 ? "bg-fg-subtle" : "bg-line"}`}
            style={{ left: PAD_L, right: PAD_R, top: yOf(t) }}
          />
          <span className="absolute w-11 text-right text-fg-subtle type-mono" style={{ left: 0, top: yOf(t) - 8 }}>
            {t}
          </span>
        </div>
      ))}

      <ProblemLines problems={asset.problems} range={range} />

      <svg
        aria-hidden
        className="pointer-events-none absolute overflow-visible"
        style={{ left: PAD_L, top: 0, width: `calc(100% - ${PAD_L + PAD_R}px)`, height: 200 }}
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
      >
        <polyline
          points={points.map((p) => `${p.f * 100},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {points.map(({ r, f, y }, i) => {
        const doubt = r.quality === "QUESTIONABLE";
        // A label under a point near the axis would sit on the date grid, so it goes above.
        const want = labelSide(rs, i);
        const side = want === "below" && y + 24 > TOP + PLOT_H ? "above" : want;
        const half = doubt ? 12 : 7;
        const value = r.unit === "score" ? String(r.value) : r.value.toFixed(1);
        const open = active === r.reading_id;
        // Tooltips open below-left of the point, or below-right near the left edge.
        const flip = f < 0.3;
        return (
          <div key={r.reading_id}>
            <span
              aria-hidden
              className={`absolute whitespace-nowrap type-mono ${doubt ? "text-questionable" : "text-fg"}`}
              style={
                side === "above"
                  ? { left: xCss(f), top: y - half - 6 - 16, transform: "translateX(-50%)" }
                  : side === "below"
                    ? { left: xCss(f), top: y + half + 9, transform: "translateX(-50%)" }
                    : { left: xCss(f), top: y - 8, transform: `translateX(calc(-100% - ${half + 5}px))` }
              }
            >
              {value}
              {doubt ? " ?" : ""}
            </span>
            <button
              type="button"
              aria-label={`${m.name} ${tooltipText(asset, r)}${doubt ? ". Check sensor: SPOT doubted this reading" : ""}`}
              aria-expanded={open}
              onMouseEnter={() => onActive(r.reading_id)}
              onFocus={() => onActive(r.reading_id)}
              onClick={() => onActive(open ? null : r.reading_id)}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ left: xCss(f), top: y, width: doubt ? 28 : 22, height: doubt ? 28 : 22 }}
            >
              {doubt ? (
                <Glyph name="check-sensor" size={24} />
              ) : (
                <span className="block size-3.5 rounded-full border-2 border-surface bg-fg" />
              )}
            </button>
            {open && (
              <div
                aria-hidden
                className="pointer-events-none absolute z-20 flex flex-col gap-0.5 rounded-[12px] border-2 border-line-strong bg-surface px-3 py-2 whitespace-nowrap shadow-sticker"
                style={{
                  left: xCss(f),
                  top: y + 18,
                  transform: flip ? "translateX(6px)" : "translateX(calc(-100% - 6px))",
                }}
              >
                <span
                  className={`flex items-center gap-1.5 type-body-strong ${doubt ? "text-questionable" : "text-fg"}`}
                >
                  {doubt ? (
                    <Glyph name="check-sensor" size={16} />
                  ) : (
                    <span className="block size-3 rounded-full bg-fg" />
                  )}
                  {doubt ? "Check sensor" : "Good reading"}
                </span>
                <span className="text-fg-muted type-body-sm">{tooltipText(asset, r)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProblemMarker({ p }: { p: Problem }) {
  const label = `${SEVERITY_LABEL[p.severity]} finding: ${ANOMALY_LABEL[p.anomaly_type]}, ${p.mission_id}, ${dayTime(p.timestamp)}`;
  return (
    <a href={`#problem-${p.anomaly_id}`} aria-label={label} title={label} className="block rounded-full">
      {isSerious(p) ? (
        <Glyph name="blight" size={26} />
      ) : (
        <span className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-surface">
          {p.severity === "MEDIUM" ? <AlertCircle size={16} aria-hidden /> : <Info size={16} aria-hidden />}
        </span>
      )}
    </a>
  );
}

function ProblemLane({ problems, range }: { problems: Problem[]; range: Range }) {
  const rows = laneRows(problems);
  return (
    <div className="relative h-[84px] w-full">
      <p className="absolute top-3 left-0 type-body-strong">Problems</p>
      <div aria-hidden className="absolute h-px bg-line" style={{ left: PAD_L, right: PAD_R, top: 30 }} />
      <ol aria-label="Problems by date">
        {problems.map((p) => (
          <li
            key={p.anomaly_id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: xCss(xFrac(p.timestamp, range)), top: rows.get(p.anomaly_id) ? 46 : 18 }}
          >
            <ProblemMarker p={p} />
          </li>
        ))}
      </ol>
      <div aria-hidden>
        {Array.from({ length: range.days }, (_, i) => {
          const ts = new Date(range.start + i * 86_400_000).toISOString();
          return (
            <span
              key={i}
              className="absolute top-16 -translate-x-1/2 whitespace-nowrap text-fg-subtle type-mono"
              style={{ left: xCss((i + 0.5) / range.days) }}
            >
              {dayLabel(ts)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function OneOff({ asset, r }: { asset: AssetDetail; r: Reading }) {
  const m = MEASUREMENT[r.measurement_type as Series["type"]];
  const doubt = r.quality === "QUESTIONABLE";
  const a = actionFor(asset, r.action_id);
  const what = a ? stepPhrase(a) : m.noun[0];
  return (
    <li className="flex flex-col gap-1 rounded-[12px] border-[1.5px] border-line bg-canvas px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="type-body-strong">{m.name}</span>
        <span className={`type-number-md ${doubt ? "text-questionable" : "text-fg"}`}>{readingValue(r)}</span>
      </div>
      <span className={`flex items-center gap-1.5 type-badge ${doubt ? "text-questionable" : "text-success"}`}>
        <Glyph name={doubt ? "check-sensor" : "bloom"} size={18} />
        {doubt ? "Check sensor" : "Good"}
      </span>
      <span className="text-fg-muted type-body-sm">
        {dayTime(r.timestamp)} · {what}
      </span>
    </li>
  );
}

function Legend({ asset }: { asset: AssetDetail }) {
  const noun = assetNoun(asset.asset_type);
  return (
    <>
      <h3 className="type-body-strong">How to read this</h3>
      <ul className="flex flex-col gap-3 type-body-sm">
        <li className="flex items-center gap-2.5">
          <span className="flex size-5 items-center justify-center">
            <span className="block size-3.5 rounded-full bg-fg" />
          </span>
          Good reading
        </li>
        <li className="flex items-center gap-2.5">
          <Glyph name="check-sensor" size={20} />
          Check sensor: SPOT doubted this reading
        </li>
        <li className="flex items-center gap-2.5">
          <Glyph name="blight" size={20} />
          High or critical finding
        </li>
        <li className="flex items-center gap-2.5">
          <span className="flex size-5 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-surface">
            <AlertCircle size={14} aria-hidden />
          </span>
          Medium or low finding
        </li>
      </ul>
      <p className="text-fg-muted type-body-sm">
        {asset.normal_bands.length > 0
          ? `Shaded bands show the normal range (${asset.normal_bands[0].source}). `
          : `No normal range is shaded: the kit gives no limits for this ${noun}, so we only flag readings SPOT itself questioned. `}
        Robot position readings are hidden here.
      </p>
    </>
  );
}

export function ReadingHistory({ asset }: { asset: AssetDetail }) {
  const range = dayRange(asset);
  const { charts, oneOffs } = splitSeries(equipmentReadings(asset));
  // Like the Figma frame, the first questioned point on the first chart starts with its note open.
  const pinned = charts[0]?.readings.find((r) => r.quality === "QUESTIONABLE")?.reading_id ?? null;
  const [active, setActive] = useState<string | null>(pinned);

  return (
    <section
      aria-labelledby="reading-history-heading"
      className="flex flex-col gap-5 bg-surface px-5 pt-6 pb-7 sticker sm:px-7"
      onKeyDown={(e) => e.key === "Escape" && setActive(null)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="reading-history-heading" className="type-heading-lg">
          Reading history
        </h2>
        {range && (
          <p className="text-fg-subtle type-label">Equipment readings only · {rangeLabel(range.from, range.to)}</p>
        )}
      </div>

      {!range ? (
        <p className="text-fg-muted type-body">SPOT has no equipment readings or problems on file for this asset.</p>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row">
          <div
            className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-auto"
            onMouseLeave={() => setActive(pinned)}
          >
            <div className="flex min-w-[720px] flex-col gap-4">
              {charts.map((s) => (
                <Chart key={s.type} asset={asset} series={s} range={range} active={active} onActive={setActive} />
              ))}
              {charts.length === 0 && (
                <p className="text-fg-muted type-body">
                  No trend yet: a chart appears once SPOT has two readings of the same kind.
                </p>
              )}
              {(charts.length > 0 || asset.problems.length > 0) && (
                <ProblemLane problems={asset.problems} range={range} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-[296px] lg:shrink-0">
            {oneOffs.length > 0 && (
              <>
                <h3 className="type-body-strong">One-off readings</h3>
                <ul className="flex flex-col gap-3">
                  {oneOffs.map((r) => (
                    <OneOff key={r.reading_id} asset={asset} r={r} />
                  ))}
                </ul>
                <div aria-hidden className="h-[1.5px] w-full bg-line" />
              </>
            )}
            <Legend asset={asset} />
          </div>
        </div>
      )}
    </section>
  );
}
