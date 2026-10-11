import { awaitingReview, DECISION_NAME } from "@/lib/report";
import type { Problem } from "@/lib/types";

/** "Awaiting review" (flagged, no decision yet) or "Decision saved · Watch". Shared with Asset Detail. */
export function ReviewState({ problem: p }: { problem: Pick<Problem, "operator_review_required" | "decision"> }) {
  if (p.decision) return <p className="text-fg-muted type-label">Decision saved · {DECISION_NAME[p.decision]}</p>;
  if (awaitingReview(p)) return <p className="text-high type-label">Awaiting review</p>;
  return null;
}
