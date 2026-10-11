"use client";

import { useRouter } from "next/navigation";
import { titleCase } from "@/lib/format";
import type { MissionSummary } from "@/lib/types";

export type MissionOption = Pick<MissionSummary, "mission_id" | "mission_name" | "scenario" | "configuration_version">;

/** "Autowalk Inspection Route 14" -> "Autowalk Route 14", as in the Figma chip. */
const shortName = (name: string) => name.replace(/\bInspection\s+/, "");

export const missionLabel = (m: MissionOption) =>
  `${m.mission_id} · ${shortName(m.mission_name)} · ${titleCase(m.scenario)} ${m.configuration_version}`;

/**
 * The top bar's mission chip, as a picker: switching replays another of the recorded missions.
 * Keeps the what-if params (?heat, ?cold, ?obstacle, ?outdoor, ?wx) and drops ?at, which is a time in the old mission.
 */
export function MissionPicker({ current, missions }: { current: MissionOption; missions: MissionOption[] }) {
  const router = useRouter();
  const options = missions.some((m) => m.mission_id === current.mission_id) ? missions : [current, ...missions];

  function go(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.delete("at");
    params.set("mission", id);
    router.push(`/live?${params}`);
  }

  return (
    <div className="relative min-w-0 shrink">
      <select
        aria-label="Mission to replay"
        value={current.mission_id}
        onChange={(e) => go(e.target.value)}
        className="w-full max-w-[22rem] cursor-pointer appearance-none truncate rounded-pill border-[1.5px] border-line-strong bg-surface py-1.5 pr-7 pl-2.5 text-fg-muted type-mono hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {options.map((m) => (
          <option key={m.mission_id} value={m.mission_id}>
            {missionLabel(m)}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted type-mono">
        ▾
      </span>
    </div>
  );
}
