import Image from "next/image";
import { XCircle } from "lucide-react";
import { Glyph } from "@/components/ui/Glyph";
import { dateOf, timeOf, titleCase } from "@/lib/format";
import { heroSentence, SERIOUS } from "@/lib/report";
import type { MissionDetail } from "@/lib/types";

// The honest headline: "Completed" stays small and neutral, the failures are big and coloured.
export function MissionHeadline({ mission: m }: { mission: MissionDetail }) {
  const total = m.actions.length;
  const failed = m.failed_actions;
  const serious = m.problems.filter((p) => SERIOUS.includes(p.severity)).length;
  const meta = [
    m.mission_id,
    m.mission_name,
    `${titleCase(m.scenario)} ${m.configuration_version}`,
    `${dateOf(m.start_time)}, ${timeOf(m.start_time, false)}${m.end_time ? ` to ${timeOf(m.end_time, false)}` : ""}`,
  ].join(" · ");

  return (
    <section aria-labelledby="mission-headline" className="flex items-end gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-line-strong bg-surface px-2.5 py-1 text-fg-muted type-badge">
            {m.mission_status === "COMPLETED" ? (
              <Image src="/figma/icon-check-circle-ink.svg" alt="" width={14} height={14} />
            ) : (
              <XCircle size={14} aria-hidden className="text-failed" />
            )}
            <span>
              <span className="sr-only">SPOT reported: </span>
              {m.mission_status === "COMPLETED" ? "Completed" : "Failed"}
            </span>
          </span>
          <p className="text-fg-subtle type-mono">{meta}</p>
        </div>
        <h1 id="mission-headline" className="max-w-[1056px] text-[32px] leading-[38px] sm:type-display">
          {failed > 0 ? (
            <span className="block text-failed">{failed === 1 ? "1 step failed." : `${failed} steps failed.`}</span>
          ) : (
            <span className="block text-success">All {total} steps succeeded.</span>
          )}
          {serious > 0 ? (
            <span className="block text-high">
              {serious === 1 ? "1 serious finding recorded." : `${serious} serious findings recorded.`}
            </span>
          ) : (
            <span className="block text-fg">No serious problems found.</span>
          )}
        </h1>
        <p className="text-fg-muted type-lead">{heroSentence(m)}</p>
      </div>

      {/* Verdict sticker: decorative summary of the facts strip below, hidden from screen readers. */}
      <div aria-hidden className="hidden h-[190px] w-[167px] shrink-0 items-center justify-center md:flex">
        <div className="flex rotate-[4deg] flex-col items-center gap-2 bg-pollen-tint p-5 sticker">
          <Glyph name={failed > 0 ? "blight" : "bloom"} size={72} />
          <p className="font-display text-[20px] font-semibold leading-6 text-failed">{failed} failed</p>
          <p className="font-display text-[20px] font-semibold leading-6 text-success">{total - failed} succeeded</p>
        </div>
      </div>
    </section>
  );
}
