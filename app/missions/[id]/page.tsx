import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FactsStrip } from "@/components/report/FactsStrip";
import { MissionExplanation } from "@/components/report/MissionExplanation";
import { MissionHeadline } from "@/components/report/MissionHeadline";
import { ProblemList } from "@/components/report/ProblemList";
import { RouteVine } from "@/components/report/RouteVine";
import { getMission } from "@/lib/api";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Mission ${id}` };
}

// Screen B: Mission Report. The AI mission brief leads, right under the headline; problems sit above the route.
export default async function MissionReportPage({ params }: Props) {
  const { id } = await params;
  const mission = await getMission(id);
  if (!mission) notFound();

  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10">
      <MissionHeadline mission={mission} />
      <MissionExplanation mission={mission} />
      <FactsStrip mission={mission} />
      <ProblemList problems={mission.problems} />
      <RouteVine mission={mission} />
    </div>
  );
}
