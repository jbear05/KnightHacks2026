import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Missions" };

export default function MissionsPage() {
  return (
    <EmptyState title="Missions">
      <p>The mission list is coming next. The demo mission is ready:</p>
      <Link href="/missions/M014" className="self-start text-success type-body-strong underline-offset-2 hover:underline">
        M014 · Autowalk Inspection Route 14 →
      </Link>
    </EmptyState>
  );
}
