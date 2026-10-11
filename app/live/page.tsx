import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveMission } from "@/components/live/LiveMission";
import { getMission, getMissions } from "@/lib/api";
import { scenarioFromParams } from "@/lib/scenarios";
import { outdoorFromParams } from "@/lib/weather";

export const metadata: Metadata = { title: "Live mission" };

type Props = { searchParams: Promise<{ mission?: string; at?: string; heat?: string; cold?: string; obstacle?: string; outdoor?: string; place?: string; wx?: string }> };

// Screen A: Live Mission. Replays a recorded mission (default M014, ?mission=M017 for another;
// ?at=02:14:00 opens it paused at that plant time; ?heat=16&obstacle=1 or ?cold=55 turns on the what-ifs;
// ?outdoor=1&place=Chicago, IL checks today's forecast first, ?wx=storm with a demo day instead).
export default async function LivePage({ searchParams }: Props) {
  const { mission: id = "M014", at, heat, cold, obstacle, outdoor, place, wx } = await searchParams;
  // The picker is a convenience: if the list fails to load, the replay still plays.
  const [mission, missions] = await Promise.all([getMission(id), getMissions().catch(() => [])]);
  if (!mission) notFound();
  const options = missions
    .map(({ mission_id, mission_name, scenario, configuration_version }) => ({ mission_id, mission_name, scenario, configuration_version }))
    .sort((a, b) => a.mission_id.localeCompare(b.mission_id));
  // key: switching missions starts a fresh replay (clock, what-ifs, selection) instead of reusing state.
  return (
    <LiveMission
      key={mission.mission_id}
      mission={mission}
      missions={options}
      at={at}
      scenario={scenarioFromParams(heat, obstacle, cold)}
      outdoor={outdoorFromParams(outdoor, place, wx)}
    />
  );
}
