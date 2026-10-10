import type { Metadata } from "next";
import { BatteryChart } from "@/components/insights/BatteryChart";
import { CompareBand } from "@/components/insights/CompareBand";
import { FailureCauses } from "@/components/insights/FailureCauses";
import { FindingsHeatmap, HeatmapLegend } from "@/components/insights/FindingsHeatmap";
import { InsightsHero } from "@/components/insights/InsightsHero";
import { ReliabilityBars } from "@/components/insights/ReliabilityBars";
import { ChartCard, SoWhat } from "@/components/insights/SoWhat";
import { getInsights, getMissions } from "@/lib/api";
import {
  batteryBars,
  batterySoWhat,
  causeBars,
  causesSoWhat,
  failedSteps,
  hero,
  heatmapSoWhat,
  hotspot,
  nextWorst,
  reliabilitySoWhat,
  stopLabel,
  typeBars,
} from "@/lib/insights";

export const metadata: Metadata = { title: "Insights" };
// Read fresh numbers on every request (and never call the API at build time).
export const dynamic = "force-dynamic";

// Screen C: Insights across all missions. Every chart ends in a "So what" sentence.
export default async function InsightsPage() {
  const [insights, missions] = await Promise.all([getInsights(), getMissions()]);
  const hot = hotspot(insights);
  const heat = Object.fromEntries(insights.byLocation.map((l) => [l.location_id, l.problems]));
  const worst = nextWorst(insights);

  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10">
      <InsightsHero hero={hero(insights, missions)} />
      <CompareBand insights={insights} />

      <div className="flex flex-col gap-8 min-[1360px]:flex-row">
        <ChartCard id="heatmap-heading" title="Where findings cluster" meta="Problems per stop · all runs" className="min-[1360px]:w-[800px] min-[1360px]:shrink-0">
          <SoWhat>{heatmapSoWhat(insights)}</SoWhat>
          <FindingsHeatmap
            heat={heat}
            heatLabel={(id) => stopLabel(insights, id)}
            hotspot={
              hot && {
                location_id: hot.location_id,
                title: `Hotspot · ${hot.location_name}`,
                detail: `${hot.problems} problems · ${hot.okPct}% steps ok`,
              }
            }
          />
          <HeatmapLegend />
          {worst && <p className="text-[12px] leading-4 font-medium text-fg-muted">{worst}</p>}
        </ChartCard>
        <ChartCard id="battery-heading" title="Battery vs success" meta="% of steps ok" className="flex-1">
          <SoWhat>{batterySoWhat(insights)}</SoWhat>
          <BatteryChart bars={batteryBars(insights)} />
          <p className="text-fg-subtle type-label">Battery level when the step started</p>
        </ChartCard>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <ChartCard id="reliability-heading" title="Reliability by inspection type" meta="% of steps ok" className="flex-1">
          <SoWhat>{reliabilitySoWhat(insights)}</SoWhat>
          <ReliabilityBars bars={typeBars(insights)} />
        </ChartCard>
        <ChartCard id="causes-heading" title="Why steps fail" meta={`${failedSteps(insights)} failed steps`} className="flex-1">
          <SoWhat>{causesSoWhat(insights)}</SoWhat>
          <FailureCauses bars={causeBars(insights)} />
          <p className="text-fg-subtle type-label">Lime = readings / timeouts · pink = other causes</p>
        </ChartCard>
      </div>
    </div>
  );
}
