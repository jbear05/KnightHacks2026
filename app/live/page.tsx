import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Live mission" };

export default function LivePage() {
  return (
    <EmptyState title="Live mission">
      <p>The live view (Map & Simulation&apos;s map plus the event feed and Attention Queue) is coming next.</p>
      <Link href="/missions/M014" className="self-start text-success type-body-strong underline-offset-2 hover:underline">
        Open the M014 mission report →
      </Link>
    </EmptyState>
  );
}
