import type { CauseBar } from "@/lib/insights";

// Horizontal bars of failed steps by cause. Lime = readings / timeouts, pink = everything else.
export function FailureCauses({ bars }: { bars: CauseBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <ul className="flex w-full flex-col gap-3 pt-1.5">
      {bars.map((b) => (
        <li key={b.key} className="flex items-center gap-3">
          <span className={`w-[180px] shrink-0 text-[14px] leading-5 ${b.dataQuality ? "font-extrabold" : "font-medium"}`}>
            {b.label}
          </span>
          <span aria-hidden className="h-[18px] w-[290px] min-w-0 shrink">
            <span
              className={`block h-[18px] rounded-[6px] border-[1.5px] border-line-strong ${b.dataQuality ? "bg-blight" : "bg-pollen"}`}
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </span>
          <span className="type-number-md whitespace-nowrap">
            {b.count}
            <span className="sr-only"> failed steps</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
