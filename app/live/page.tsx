import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveMission } from "@/components/live/LiveMission";
import { getMission } from "@/lib/api";
import { scenarioFromParams } from "@/lib/scenarios";

export const metadata: Metadata = { title: "Live mission" };

type Props = { searchParams: Promise<{ mission?: string; at?: string; heat?: string; obstacle?: string }> };

// Screen A: Live Mission. Replays a recorded mission (default M014, ?mission=M017 for another;
// ?at=02:14:00 opens it paused at that plant time; ?heat=16&obstacle=1 turns on the what-ifs).
export default async function LivePage({ searchParams }: Props) {
  const { mission: id = "M014", at, heat, obstacle } = await searchParams;
  const mission = await getMission(id);
  if (!mission) notFound();
  return <LiveMission mission={mission} at={at} scenario={scenarioFromParams(heat, obstacle)} />;
}
