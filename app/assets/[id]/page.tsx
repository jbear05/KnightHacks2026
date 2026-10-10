import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetFacts } from "@/components/asset/AssetFacts";
import { AssetHeadline } from "@/components/asset/AssetHeadline";
import { InspectionPhoto } from "@/components/asset/InspectionPhoto";
import { PastProblems } from "@/components/asset/PastProblems";
import { ReadingHistory } from "@/components/asset/ReadingHistory";
import { getAsset } from "@/lib/api";
import { actionFor, photoType } from "@/lib/asset";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Asset ${decodeURIComponent(id)}` };
}

// Screen D: Asset Detail. Reached from a problem row on a mission report (?from=M014).
export default async function AssetPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const asset = await getAsset(decodeURIComponent(id));
  if (!asset) notFound();

  // "Back to" the report the operator came from, else the mission behind the photo's problem.
  const came = typeof from === "string" && /^M\d{3}$/.test(from) ? from : null;
  const type = photoType(asset);
  const photoMission = asset.problems.find((p) => actionFor(asset, p.action_id)?.action_type === type)?.mission_id;
  const backTo = came ?? photoMission ?? null;

  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10">
      <AssetHeadline asset={asset} />
      <AssetFacts asset={asset} />
      <ReadingHistory asset={asset} />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <PastProblems asset={asset} />
        <InspectionPhoto asset={asset} backTo={backTo} />
      </div>
    </div>
  );
}
