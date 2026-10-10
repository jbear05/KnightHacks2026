import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <EmptyState title="Fleet insights">
      <p>Insights are coming next.</p>
    </EmptyState>
  );
}
