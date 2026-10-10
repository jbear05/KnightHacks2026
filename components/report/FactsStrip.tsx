import { StatTile } from "@/components/ui/StatTile";
import { countBySeverity } from "@/lib/report";
import type { MissionDetail } from "@/lib/types";

export function FactsStrip({ mission: m }: { mission: MissionDetail }) {
  const total = m.actions.length;
  const ok = total - m.failed_actions;
  const sev = countBySeverity(m.problems);
  const lead = sev.CRITICAL > 0 ? "CRITICAL" : "HIGH";
  const problemLabel =
    lead === "CRITICAL"
      ? `Critical problems · ${sev.HIGH} high, ${sev.MEDIUM} medium`
      : `High problems · ${sev.CRITICAL} critical, ${sev.MEDIUM} medium`;

  return (
    <section aria-label="Mission facts" className="bg-cream px-6 py-5 sticker">
      <dl className="flex flex-wrap gap-x-14 gap-y-5">
        <StatTile value={`${ok}/${total}`} label="Steps succeeded" tone="text-success" />
        <StatTile value={String(m.failed_actions)} label="Steps failed" tone={m.failed_actions ? "text-failed" : "text-fg"} />
        <StatTile
          value={String(sev[lead])}
          label={problemLabel}
          tone={sev[lead] ? (lead === "CRITICAL" ? "text-critical" : "text-high") : "text-fg"}
        />
        {m.start_battery_pct != null && m.end_battery_pct != null && (
          <StatTile value={`${m.start_battery_pct}→${m.end_battery_pct}%`} label="Battery" />
        )}
        {m.duration_min != null && <StatTile value={`${m.duration_min} min`} label="Duration" />}
      </dl>
    </section>
  );
}
