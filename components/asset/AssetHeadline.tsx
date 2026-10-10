import Image from "next/image";
import { AlertCircle, Info, Siren } from "lucide-react";
import { findingsLine, leadSentence } from "@/lib/asset";
import { floorOf, locationLabel, SEVERITY_LABEL } from "@/lib/format";
import type { AssetDetail, Criticality } from "@/lib/types";
import { SEVERITY_SCORE } from "@/lib/types";

const STICKER: Record<Criticality, string> = {
  CRITICAL: "bg-failed-tint",
  HIGH: "bg-high-tint",
  MEDIUM: "bg-spot-tint",
  LOW: "bg-low-tint",
};

// Same colours as SeverityBadge, drawn at 1.5x for the sticker.
const BADGE: Record<Criticality, string> = {
  CRITICAL: "bg-critical text-white",
  HIGH: "bg-high-tint text-high",
  MEDIUM: "bg-surface text-medium",  // the sticker needs a fill; SeverityBadge's MEDIUM is outline-only
  LOW: "bg-low-tint text-low",
};

function CriticalityIcon({ c }: { c: Criticality }) {
  if (c === "HIGH") return <Image src="/figma/icon-alert-triangle-high.svg" alt="" width={24} height={24} />;
  const Icon = c === "CRITICAL" ? Siren : c === "MEDIUM" ? AlertCircle : Info;
  return <Icon size={24} aria-hidden />;
}

export function AssetHeadline({ asset: d }: { asset: AssetDetail }) {
  const floor = floorOf(d.location_id);
  const meta = [d.asset_id, d.asset_type, locationLabel(d.location_id), floor ? `Floor ${floor}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="asset-headline" className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-fg-subtle type-mono">{meta}</p>
        <h1 id="asset-headline" className="font-display text-[32px] leading-[38px] font-bold sm:type-display">
          <span className="block">{d.asset_name}.</span>
          <span className="block">{findingsLine(d)}</span>
        </h1>
        <p className="text-[18px] leading-[1.5] font-medium text-fg-muted">{leadSentence(d)}</p>
      </div>

      <div className="flex shrink-0 items-center justify-center self-start sm:h-[161px] sm:w-[171px] sm:self-auto">
        <div
          className={`flex -rotate-3 flex-col items-center gap-2.5 px-6 py-5 sticker ${STICKER[d.criticality]}`}
        >
          <p className="text-fg-subtle type-label">Criticality</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-badge border-[2.25px] border-line-strong px-3 py-1.5 text-[18px] leading-6 font-extrabold ${BADGE[d.criticality]}`}
          >
            <CriticalityIcon c={d.criticality} />
            {SEVERITY_LABEL[d.criticality]}
          </span>
          <p className="text-center text-fg-muted type-body-sm">
            Problems here
            <br />
            count {SEVERITY_SCORE[d.criticality]}× in priority
          </p>
        </div>
      </div>
    </section>
  );
}
