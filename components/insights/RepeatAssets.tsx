import Link from "next/link";
import type { Insights } from "@/lib/types";

// Assets with more than one recorded finding, most first, each linked to its history.
export function RepeatAssets({ assets }: { assets: Insights["repeatAssets"] }) {
  if (assets.length === 0) return <p className="text-fg-muted type-body">No asset recorded more than one finding.</p>;
  const max = Math.max(...assets.map((a) => a.problems));
  return (
    <ol className="flex flex-col gap-2.5 pt-1">
      {assets.map((a) => (
        <li key={a.asset_id} className="flex items-center gap-3">
          <Link href={`/assets/${encodeURIComponent(a.asset_id)}`} className="w-[190px] shrink-0 underline-offset-2 hover:underline">
            <span className="type-body-strong">{a.asset_id}</span> <span className="text-fg-muted type-body-sm">{a.asset_name}</span>
          </Link>
          <span aria-hidden className="h-[14px] min-w-0 flex-1">
            <span className="block h-[14px] rounded-[6px] border-[1.5px] border-line-strong bg-pollen" style={{ width: `${(a.problems / max) * 100}%` }} />
          </span>
          <span className="w-[90px] shrink-0 text-right type-mono">
            {a.problems} findings
          </span>
        </li>
      ))}
    </ol>
  );
}
