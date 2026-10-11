"use client";

// The card that opens when a stop's pin is clicked on /live: map-sim's component health and simulated
// life left for the components based there (map-sim/src/sim/health.ts, IliasCoder; his sandbox card).
import { X } from "lucide-react";
import { formatLife } from "@/map-sim/src/sim/index.ts";
import { lifeLevel, stopComponents } from "@/lib/scenarios";

const LIFE_TONE = { critical: "text-critical", warning: "text-high", ok: "text-fg" } as const;
const barTone = (score: number) => (score < 40 ? "bg-critical" : score < 70 ? "bg-high" : "bg-success");

/** `finished`: action ids of this mission that have played; health counts those and every earlier mission. */
export function ComponentCard({
  stopId,
  missionId,
  finished,
  onClose,
}: {
  stopId: string;
  missionId: string;
  finished: ReadonlySet<string>;
  onClose: () => void;
}) {
  const at = stopComponents(stopId, missionId, finished);
  if (!at) return null;
  return (
    <section aria-label={`Components at ${stopId}`} className="mt-3 flex flex-col gap-2 rounded-card border-[1.5px] border-line bg-raised/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="type-body-strong">
            {stopId} · {at.stopName}
          </h2>
          <p className="text-fg-muted type-body-sm">
            {at.components.length
              ? `Health is from every inspection up to now (missions before ${missionId} and this one so far); life left is simulated from an assumed design life and age.`
              : "No components are based at this stop yet."}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close components" className="shrink-0 text-fg-muted hover:text-fg">
          <X size={16} aria-hidden />
        </button>
      </div>
      {at.components.length > 0 && (
        <ul className="flex flex-col gap-2">
          {at.components.map((h) => (
            <li key={h.asset_id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 type-body-sm">
                <span>
                  <span className="type-body-strong">{h.asset_id}</span> <span className="text-fg-muted">{h.type}</span>
                </span>
                <span className={`shrink-0 type-mono ${LIFE_TONE[lifeLevel(h.remainingMonths)]}`}>≈ {formatLife(h.remainingMonths)} left</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-label={`${h.asset_id} health`} aria-valuenow={h.score} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full ${barTone(h.score)}`} style={{ width: `${h.score}%` }} />
              </div>
              <p className="text-fg-muted type-body-sm">
                Health {h.score}/100 · {h.reasons[0]?.text ?? "nothing flagged in the data"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {at.visiting.length > 0 && (
        <p className="text-fg-muted type-body-sm">
          Also checked here now and then: {at.visiting.map((h) => `${h.asset_id} (based at ${h.stops[0]})`).join(", ")}
        </p>
      )}
    </section>
  );
}
