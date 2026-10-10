import { StatTile } from "@/components/ui/StatTile";
import { dayLabel, factsOf } from "@/lib/asset";
import type { AssetDetail } from "@/lib/types";

export function AssetFacts({ asset }: { asset: AssetDetail }) {
  const f = factsOf(asset);
  return (
    <section aria-label="Asset facts" className="bg-cream px-6 py-5 sticker">
      <dl className="flex flex-wrap gap-x-14 gap-y-5">
        <StatTile value={String(f.readings)} label="Readings on file" />
        <StatTile value={String(f.questionable)} label="Check sensor" tone={f.questionable ? "text-questionable" : "text-fg"} />
        <StatTile value={String(f.problems)} label="Problems found" tone={f.problems ? "text-failed" : "text-fg"} />
        <StatTile value={String(f.hidden)} label="Hidden in completed runs" tone={f.hidden ? "text-high" : "text-fg"} />
        {f.lastVisit && <StatTile value={dayLabel(f.lastVisit)} label="Last visit" />}
      </dl>
    </section>
  );
}
