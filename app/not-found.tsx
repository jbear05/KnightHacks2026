import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <EmptyState title="Not found">
      <p>There is nothing at this address.</p>
      <Link href="/missions" className="self-start text-success type-body-strong underline-offset-2 hover:underline">
        Back to missions →
      </Link>
    </EmptyState>
  );
}
