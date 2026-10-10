// Right rail of Live Mission (Figma "Right rail", 4:164): what SPOT is doing now, battery,
// attention queue and event feed. Design & Frontend owns this; see contracts/live-mission-right-rail.md.
import Image from "next/image";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ACTION_LABEL, ANOMALY_LABEL, assetOf, criticalityPhrase, FAILURE_LABEL, locationLabel, timeOf } from "@/lib/format";
import { awaitingReview, DECISION_NAME } from "@/lib/report";
import {
  BATTERY_LOW,
  BATTERY_WARN,
  clockOf,
  durationOf,
  LOW_BATTERY_INSIGHT,
  type FeedRow,
  type LiveState,
  type QueueItem,
} from "@/lib/replay";

export function RightRail({ live, total, clock, start, missionId }: { live: LiveState; total: number; clock: number; start: number; missionId: string }) {
  return (
    <aside
      aria-label="Mission status"
      className="flex flex-col overflow-hidden rounded-[6px] border-2 border-line-strong bg-surface shadow-[var(--shadow-sticker)] lg:h-[676px]"
    >
      <NowCard live={live} total={total} clock={clock} start={start} />
      <Battery live={live} />
      <AttentionQueue items={live.queue} missionId={missionId} />
      <EventFeed rows={live.feed} />
    </aside>
  );
}

function NowCard({ live, total, clock, start }: { live: LiveState; total: number; clock: number; start: number }) {
  const s = live.current;
  const a = s?.action;
  const asset = a ? assetOf(a.asset_id) : null;
  const skipping = s?.phase === "skipping";
  const title = skipping ? "Step skipped" : a ? ACTION_LABEL[a.action_type] : live.ended ? "Mission finished" : "Waiting to start";
  const label = s ? `Now · step ${s.step} of ${total}` : live.ended ? `Done · ${total} of ${total} steps` : "Now";
  const sub = skipping && s && a
    ? `Holding at ${locationLabel(s.fromLocationId)} · ${locationLabel(a.location_id)} is too hot`
    : a
      ? `${locationLabel(a.location_id)}${asset ? ` · ${asset.asset_name}` : ""}`
      : live.ended
        ? `${live.succeeded} succeeded · ${live.failed} failed`
        : "SPOT is at the Main Entrance (WP01)";
  return (
    <section className="flex shrink-0 flex-col gap-1.5 border-b border-line px-5 py-3.5" aria-live="polite" aria-atomic="true">
      <p className="text-fg-subtle type-label">{label}</p>
      <h2 className="font-display text-[30px] leading-[30px] font-bold">{title}</h2>
      <p className="text-fg-muted type-body">{sub}</p>
      {a && s && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 type-mono">
          {!skipping && (
            <div className="flex gap-1.5">
              <dt className="text-fg-subtle">{s.phase === "walking" ? "Arrives" : "Started"}</dt>
              <dd>{clockOf(s.arriveAt)}</dd>
            </div>
          )}
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">Elapsed</dt>
            <dd>{durationOf(clock - start)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-fg-subtle">Asset</dt>
            <dd>{a.asset_id}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function Battery({ live }: { live: LiveState }) {
  const pct = live.battery;
  const tone = pct === null ? "text-fg-muted" : pct < BATTERY_LOW ? "text-failed" : pct <= BATTERY_WARN ? "text-high" : "text-success";
  const fill = pct === null ? "bg-fg-muted" : pct < BATTERY_LOW ? "bg-failed" : pct <= BATTERY_WARN ? "bg-high" : "bg-success";
  const { succeeded, total } = LOW_BATTERY_INSIGHT;
  return (
    <section className="flex shrink-0 flex-col gap-1.5 border-b border-line px-5 py-3.5" aria-label="Battery">
      <div className="flex items-center gap-3.5">
        <p className={`font-display text-[34px] leading-[34px] font-bold tabular-nums ${tone}`}>{pct === null ? "—" : `${pct}%`}</p>
        <div
          role="meter"
          aria-label="Battery level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? 0}
          className="relative h-3 min-w-px flex-1 overflow-hidden rounded-badge border-[1.5px] border-line-strong bg-raised"
        >
          <div className={`absolute -top-[1.5px] -left-[1.5px] h-3 rounded-badge ${fill}`} style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
      <p className="text-fg-subtle type-body-sm">
        Started at {live.startBattery ?? "—"}% · warning below {BATTERY_WARN}% · low below {BATTERY_LOW}%
      </p>
      <p className="flex items-center gap-1.5 text-fg-subtle type-badge">
        <Image src="/figma/icon-info.svg" alt="" width={14} height={14} />
        Success drops to {Math.round((succeeded / total) * 100)}% below {BATTERY_LOW}% battery ({succeeded} of {total} steps).
      </p>
    </section>
  );
}

function AttentionQueue({ items, missionId }: { items: QueueItem[]; missionId: string }) {
  return (
    <section aria-labelledby="queue-heading" className="flex shrink-0 flex-col gap-1.5 border-b border-line px-5 py-3 lg:h-[304px]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 lg:h-6">
        <h2 id="queue-heading" className="type-heading-md">
          Attention queue
        </h2>
        <p className="text-fg-muted type-label">
          {items.length} so far · {items.filter((it) => it.kind === "problem" && awaitingReview(it.problem)).length} awaiting review
        </p>
      </div>
      {items.length === 0 ? (
        <p className="pt-1 text-fg-muted type-body-sm">No failed steps or serious findings yet. They land here as the replay reaches them.</p>
      ) : (
        <ul className="-mx-5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-5">
          {items.map((it) => (
            <li key={it.key} className="flex h-[76px] shrink-0 flex-col gap-[3px] border-b border-line pt-[5px]">
              {it.kind === "problem" ? <ProblemRow item={it} /> : it.kind === "sim" ? <SimRow item={it} /> : <FailedRow item={it} missionId={missionId} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProblemRow({ item: { problem: p } }: { item: Extract<QueueItem, { kind: "problem" }> }) {
  return (
    <>
      <div className="flex justify-between gap-3 type-body-strong">
        <p className="truncate">
          {p.asset_id} · {ANOMALY_LABEL[p.anomaly_type]}
        </p>
        <Link href={`/assets/${encodeURIComponent(p.asset_id)}`} className="shrink-0 hover:underline" aria-label={`Open ${p.asset_id}`}>
          Open →
        </Link>
      </div>
      <p className="truncate text-fg-muted type-body-sm">
        {locationLabel(p.location_id)} · {criticalityPhrase(p.asset_criticality)}
      </p>
      <div className="flex items-center gap-2">
        <SeverityBadge severity={p.severity} />
        <p className="truncate text-fg-muted type-mono">
          Priority {p.priority} · {timeOf(p.timestamp)} · {p.decision ? `Decision saved: ${DECISION_NAME[p.decision]}` : "Awaiting review"}
        </p>
      </div>
    </>
  );
}

/** A what-if alert from Map & Sim's scenarios; always tagged so nobody mistakes it for data. */
function SimRow({ item }: { item: Extract<QueueItem, { kind: "sim" }> }) {
  const critical = item.level === "critical";
  return (
    <>
      <p className={`truncate type-body-strong ${critical ? "text-critical" : "text-high"}`}>{item.title}</p>
      <p className="truncate text-fg-muted type-body-sm" title={item.detail}>
        {item.detail}
      </p>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-badge border-[1.5px] border-line-strong px-2 py-1 type-badge ${critical ? "bg-failed-tint text-critical" : "bg-high-tint text-high"}`}
        >
          <FlaskConical aria-hidden size={16} />
          What-if
        </span>
        <p className="text-fg-muted type-mono">{item.time}</p>
      </div>
    </>
  );
}

function FailedRow({ item: { action: a }, missionId }: { item: Extract<QueueItem, { kind: "failed" }>; missionId: string }) {
  return (
    <>
      <div className="flex justify-between gap-3 type-body-strong">
        <p className="truncate">
          {ACTION_LABEL[a.action_type]} failed · {a.location_id}
        </p>
        <Link href={`/missions/${encodeURIComponent(missionId)}`} className="shrink-0 hover:underline" aria-label={`Open step ${a.sequence} in the mission report`}>
          Open →
        </Link>
      </div>
      <p className="truncate text-fg-muted type-body-sm">
        {a.failure_type ? FAILURE_LABEL[a.failure_type] : "Step failed"} · step {a.sequence}
      </p>
      <div className="flex items-center gap-2">
        <StatusBadge status="FAILED" />
        <p className="text-fg-muted type-mono">{timeOf(a.timestamp)}</p>
      </div>
    </>
  );
}

const FEED_GLYPH: Record<FeedRow["glyph"], string> = {
  next: "/figma/glyph-next.svg",
  bloom: "/figma/glyph-bloom.svg",
  blight: "/figma/glyph-blight.svg",
  problem: "/figma/icon-alert-triangle-high.svg",
  spot: "/figma/glyph-spot.svg",
  sim: "",
};

function EventFeed({ rows }: { rows: FeedRow[] }) {
  return (
    <section aria-labelledby="feed-heading" className="flex min-h-[134px] flex-1 flex-col gap-1.5 px-5 pt-3.5 lg:min-h-0">
      <div className="flex items-center justify-between">
        <h2 id="feed-heading" className="type-heading-md">
          Event feed
        </h2>
        <p className="text-fg-subtle type-label">newest first</p>
      </div>
      <ol role="log" className="-mx-5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-5 pb-3.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-fg-subtle type-mono">{r.time}</span>
            {r.glyph === "sim" ? (
              <FlaskConical aria-label="What-if" size={14} strokeWidth={2.25} className="shrink-0 text-high" />
            ) : (
              <Image src={FEED_GLYPH[r.glyph]} alt="" width={14} height={14} />
            )}
            <span className="type-body-sm">{r.text}</span>
            <span className="truncate text-fg-muted type-body-sm">{r.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
