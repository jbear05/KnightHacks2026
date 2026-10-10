import Image from "next/image";
import { AlertCircle, Info, Siren } from "lucide-react";
import { SEVERITY_LABEL } from "@/lib/format";
import type { Severity } from "@/lib/types";

// Colour + icon + label, never colour alone. HIGH uses the exported Figma icon; the Figma file
// only has the HIGH variant drawn on this screen, so the others use lucide icons from the plan's table.
// MEDIUM is an outline badge in Figma: medium-coloured border, no fill.
const STYLE: Record<Severity, string> = {
  CRITICAL: "border-line-strong bg-critical text-white",
  HIGH: "border-line-strong bg-high-tint text-high",
  MEDIUM: "border-medium text-medium",
  LOW: "border-line-strong bg-low-tint text-low",
};

export function SeverityBadge({ severity, className = "" }: { severity: Severity; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-badge border-[1.5px] px-2 py-1 type-badge ${STYLE[severity]} ${className}`}
    >
      {severity === "HIGH" ? (
        <Image src="/figma/icon-alert-triangle-high.svg" alt="" width={16} height={16} />
      ) : severity === "CRITICAL" ? (
        <Siren size={16} aria-hidden />
      ) : severity === "MEDIUM" ? (
        <AlertCircle size={16} aria-hidden />
      ) : (
        <Info size={16} aria-hidden />
      )}
      {SEVERITY_LABEL[severity]}
      <span className="sr-only"> severity</span>
    </span>
  );
}
