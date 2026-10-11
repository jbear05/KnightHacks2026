import type { Metadata } from "next";
import Link from "next/link";
import { BatteryChart } from "@/components/insights/BatteryChart";
import { CompareBand } from "@/components/insights/CompareBand";
import { ConfigTypeTable } from "@/components/insights/ConfigTypeTable";
import { FailureCauses } from "@/components/insights/FailureCauses";
import { InsightsHero } from "@/components/insights/InsightsHero";
import { InsightsMap } from "@/components/insights/InsightsMap";
import { ReliabilityBars } from "@/components/insights/ReliabilityBars";
import { RepeatAssets } from "@/components/insights/RepeatAssets";
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
  locationRankings,
  MIN_RANKED_STEPS,
  reliabilitySoWhat,
  repeatSoWhat,
  typeBars,
} from "@/lib/insights";

export const metadata: Metadata = { title: "Insights" };
// Read fresh numbers on every request (and never call the API at build time).
export const dynamic = "force-dynamic";

// Screen C: Insights across all missions. Every chart ends in a "So what" sentence.
export default async function InsightsPage() {
  const [insights, missions] = await Promise.all([getInsights(), getMissions()]);
  const ranks = locationRankings(insights);

  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10">
      <InsightsHero hero={hero(insights, missions)} />
      <CompareBand insights={insights} />
      <ChartCard id="config-type-heading" title="V1 vs V2 by inspection type" meta="steps ok / steps run">
        <ConfigTypeTable insights={insights} />
      </ChartCard>

      <div className="flex flex-col gap-8 min-[1360px]:flex-row">
        <ChartCard id="heatmap-heading" title="Where findings cluster" meta="Recorded findings per stop · all runs" className="min-[1360px]:w-[800px] min-[1360px]:shrink-0">
          <SoWhat>{heatmapSoWhat(insights)}</SoWhat>
          <InsightsMap insights={insights} />
          <dl className="grid gap-x-8 gap-y-1 text-fg-muted type-body-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-fg-subtle type-label">Most findings</dt>
              {ranks.byFindings.map((l) => (
                <dd key={l.location_id}>
                  {l.location_name} ({l.location_id}) · {l.problems} findings across {l.steps} steps
                </dd>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-fg-subtle type-label">Lowest step success ({MIN_RANKED_STEPS}+ steps)</dt>
              {ranks.byFailure.map((l) => (
                <dd key={l.location_id}>
                  {l.location_name} ({l.location_id}) · {l.stat.succeeded} of {l.stat.total} ok ({l.pct}%)
                </dd>
              ))}
            </div>
          </dl>
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

      <ChartCard id="repeat-heading" title="Assets with repeat findings" meta={`${insights.repeatAssets.length} assets · 2+ findings`}>
        <SoWhat>{repeatSoWhat(insights)}</SoWhat>
        <RepeatAssets assets={insights.repeatAssets} />
        <p className="text-fg-subtle type-body-sm">
          Counts include every severity. A finding&apos;s priority (severity × asset criticality) is on its{" "}
          <Link href="/missions" className="underline underline-offset-2">
            mission report
          </Link>
          .
        </p>
      </ChartCard>
    </div>
  );
}
