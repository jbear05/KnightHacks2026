import { configTypeRows, pct, SMALL_GROUP } from "@/lib/insights";
import type { Insights, RateStat } from "@/lib/types";

// V1 vs V2 step success within each inspection type, with every denominator shown.
export function ConfigTypeTable({ insights }: { insights: Insights }) {
  const rows = configTypeRows(insights);
  if (rows.length === 0) {
    return <p className="text-fg-muted type-body-sm">The API sent no per-type breakdown, so only the overall comparison is shown.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div role="region" aria-label="V1 versus V2 by inspection type" tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <caption className="sr-only">Steps that succeeded on V1 and V2, by inspection type</caption>
          <thead>
            <tr className="border-b-2 border-line-strong text-fg-subtle type-label">
              <th scope="col" className="py-2 pr-3 font-medium">Inspection type</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Baseline V1</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Improved V2</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.action_type} className="border-b border-line">
                <th scope="row" className="py-2 pr-3 type-body-strong">
                  {r.label}
                  {r.small && <span className="ml-2 text-fg-subtle type-label">small sample</span>}
                </th>
                <Cell stat={r.V1} />
                <Cell stat={r.V2} />
                <td className="py-2 pl-3 text-right type-mono">
                  {r.diff === null ? "no steps on one side" : `${r.diff > 0 ? "+" : ""}${r.diff.toFixed(1)} pts`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-fg-subtle type-body-sm">
        Same inspection type on both sides, so the overall gap is not just a different mix of checks. Routes, stops and battery
        still differ between runs. “Small sample” = fewer than {SMALL_GROUP} steps on either side.
      </p>
    </div>
  );
}

function Cell({ stat }: { stat: RateStat }) {
  return (
    <td className="px-3 py-2 text-right whitespace-nowrap">
      {stat.total === 0 ? (
        <span className="text-fg-subtle type-mono">no steps</span>
      ) : (
        <>
          <span className="type-body-strong">{pct(stat)}%</span>{" "}
          <span className="text-fg-subtle type-mono">
            {stat.succeeded}/{stat.total}
          </span>
        </>
      )}
    </td>
  );
}
