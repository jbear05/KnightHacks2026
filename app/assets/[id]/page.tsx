import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Asset ${decodeURIComponent(id)}` };
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;
  return (
    <EmptyState title={`Asset ${decodeURIComponent(id)}`}>
      <p>Asset Detail (reading history and past problems) is coming next.</p>
    </EmptyState>
  );
}
