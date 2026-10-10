import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import type { ActionStatus } from "@/lib/types";

// Action execution only. Equipment findings use SeverityBadge.
export function StatusBadge({ status }: { status: ActionStatus }) {
  const failed = status === "FAILED";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-badge border-[1.5px] border-line-strong px-2 py-1 type-badge ${
        failed ? "bg-failed-tint text-failed" : "bg-success-tint text-success"
      }`}
    >
      {failed ? (
        <Image src="/figma/icon-x-circle-failed.svg" alt="" width={16} height={16} />
      ) : (
        <CheckCircle2 size={16} aria-hidden />
      )}
      {failed ? "Failed" : "Succeeded"}
    </span>
  );
}
