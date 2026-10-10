import type { Metadata } from "next";
import { MissionIndex } from "@/components/missions/MissionIndex";
import { getMissions } from "@/lib/api";
import { NO_FILTERS, type MissionFilters } from "@/lib/missions";

export const metadata: Metadata = { title: "Missions" };
// Read fresh rows on every request (and never call the API at build time).
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

// Mission index: every recorded run, with links to its report and replay.
export default async function MissionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initial: MissionFilters = {
    q: typeof sp.q === "string" ? sp.q.slice(0, 80) : "",
    config: pick(sp.config, ["all", "V1", "V2"], NO_FILTERS.config),
    status: pick(sp.status, ["all", "COMPLETED", "FAILED"], NO_FILTERS.status),
    show: pick(sp.show, ["all", "issues", "serious", "clean"], NO_FILTERS.show),
    sort: pick(sp.sort, ["newest", "oldest", "serious"], NO_FILTERS.sort),
  };
  const missions = await getMissions();

  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10">
      <div className="flex flex-col gap-2">
        <h1 className="type-heading-lg">Missions</h1>
        <p className="max-w-[760px] text-fg-muted type-body">
          Every recorded SPOT run. “Completed” only means SPOT finished its route, so runs that completed with failed steps or
          high/critical findings are marked “with issues”. Open a report for the evidence, or a replay reconstructed from the
          mission records.
        </p>
      </div>
      <MissionIndex missions={missions} initial={initial} />
    </div>
  );
}
