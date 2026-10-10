import { Glyph } from "@/components/ui/Glyph";
import { heroLead, type Hero } from "@/lib/insights";

// Fleet headline: how many serious problems sat inside runs SPOT called "completed".
export function InsightsHero({ hero: h }: { hero: Hero }) {
  return (
    <section aria-labelledby="insights-headline" className="flex items-center gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-fg-subtle type-mono">
          All missions · {h.runs} runs · {h.steps} steps · {h.dateRange}
        </p>
        <h1 id="insights-headline" className="text-[32px] leading-[38px] sm:type-display">
          {h.hidden > 0 ? (
            <>
              <span className="block text-fg">{h.hidden === 1 ? "1 serious problem" : `${h.hidden} serious problems`}</span>
              <span className="block text-failed">hid in “completed” runs.</span>
            </>
          ) : (
            <span className="block text-success">No serious problems hid in “completed” runs.</span>
          )}
        </h1>
        <p className="text-[18px] leading-[1.5] font-medium text-fg-muted">{heroLead(h)}</p>
      </div>

      {/* Verdict sticker: decorative repeat of the headline, hidden from screen readers. */}
      <div aria-hidden className="hidden h-[184px] w-[189px] shrink-0 items-center justify-center md:flex">
        <div className="flex rotate-[4deg] flex-col items-center gap-1.5 bg-pollen-tint p-5 sticker">
          <Glyph name={h.hidden > 0 ? "blight" : "bloom"} size={72} />
          <p className="font-display text-[20px] font-semibold leading-6 text-failed">{h.hidden} hidden</p>
          <p className="whitespace-nowrap text-fg type-body-strong">
            {h.completed} of {h.runs} “complete”
          </p>
        </div>
      </div>
    </section>
  );
}
