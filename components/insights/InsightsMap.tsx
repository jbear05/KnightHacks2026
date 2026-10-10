"use client";

import Image from "next/image";
import { FacilityMap } from "@/components/map/FacilityMap";
import { Glyph } from "@/components/ui/Glyph";
import { hotspot, stopLabel } from "@/lib/insights";
import type { Insights } from "@/lib/types";

// "Where findings cluster": Map & Sim's FacilityMap in heatmap mode, one glow per stop sized by problems.
export function InsightsMap({ insights }: { insights: Insights }) {
  const heat = Object.fromEntries(insights.byLocation.map((l) => [l.location_id, l.problems]));
  const hot = hotspot(insights);
  return (
    <>
      <FacilityMap
        mode="heatmap"
        heat={heat}
        heatMetric="anomalies"
        heatLabel={(id) => stopLabel(insights, id)}
        callout={
          hot && {
            location_id: hot.location_id,
            title: `Hotspot · ${hot.location_name}`,
            detail: `${hot.problems} problems · ${hot.okPct}% steps ok`,
          }
        }
        className="w-full overflow-hidden rounded-[12px] border-2 border-line-strong"
      />
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
          <span className="rounded-pill border-[1.5px] border-line-strong bg-surface px-1.5 font-mono text-[12px] leading-4 font-medium text-failed">
            6
          </span>
          problems at that stop
        </li>
      </ul>
    </>
  );
}
