"use client";

// Replay bar under the map (Figma "Replay bar", Live Mission 4:292). Holds no state: everything
// comes from useReplay(). Contract-wise this is the ReplayControls slot; Map & Sim can swap in
// their own <ReplayControls /> and keep this styling.
import Image from "next/image";
import { Play } from "lucide-react";
import { ACTION_LABEL } from "@/lib/format";
import { clockOf, durationOf, msOf } from "@/lib/replay";
import type { Action } from "@/lib/types";
import type { Replay, Speed } from "./useReplay";

const SPEEDS: Speed[] = [1, 10, 60];

export function ReplayBar({ replay, plan, results }: { replay: Replay; plan: Action[]; results: Map<string, boolean> }) {
  const span = Math.max(1, replay.end - replay.start);
  const pct = (t: number) => `${((t - replay.start) / span) * 100}%`;
  const mid = replay.start + span / 2;

  return (
    <div className="sticker flex flex-wrap items-center gap-y-1 bg-surface px-[18px] pt-3 md:h-16 md:flex-nowrap md:pt-0">
      <button
        type="button"
        onClick={replay.playing ? replay.pause : replay.play}
        aria-label={replay.playing ? "Pause replay" : "Play replay"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-line-strong text-white"
      >
        {replay.playing ? <Image src="/figma/icon-pause.svg" alt="" width={14} height={14} /> : <Play size={14} fill="currentColor" aria-hidden />}
      </button>

      <div role="radiogroup" aria-label="Replay speed" className="ml-5 flex shrink-0 overflow-hidden rounded-pill border-[1.5px] border-line-strong">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={replay.speed === s}
            onClick={() => replay.setSpeed(s)}
            className={`px-[9px] py-[5px] type-mono ${replay.speed === s ? "bg-raised text-fg" : "text-fg-muted hover:bg-raised/60"}`}
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Scrubber: a native range input for keyboard and drag, with the step markers drawn over it. */}
      <div className="relative order-last h-16 min-w-0 basis-full md:order-none md:mr-[49px] md:ml-[9px] md:flex-1 md:basis-auto">
        <div className="absolute inset-x-0 top-[25px] h-0.5 bg-line-strong" />
        <div className="absolute left-0 top-[25px] h-0.5 bg-fg-muted" style={{ width: pct(replay.clock) }} />
        <input
          type="range"
          min={replay.start}
          max={replay.end}
          step={1000}
          value={replay.clock}
          onChange={(e) => replay.seekTime(Number(e.target.value))}
          aria-label="Mission time"
          aria-valuetext={clockOf(replay.clock)}
          className="absolute inset-x-0 top-[14px] h-6 w-full cursor-pointer opacity-0"
        />
        {plan.map((a) => {
          const r = results.get(a.action_id);
          const src = r === undefined ? "/figma/glyph-next.svg" : r ? "/figma/step-success-sm.svg" : "/figma/step-failed-sm.svg";
          const size = r === undefined ? 14 : 18;
          return (
            <button
              key={a.action_id}
              type="button"
              onClick={() => replay.seekTime(msOf(a.timestamp))}
              aria-label={`Jump to step ${a.sequence}, ${ACTION_LABEL[a.action_type]} at ${a.location_id}`}
              className="absolute top-[26px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: pct(msOf(a.timestamp)) }}
            >
              <Image src={src} alt="" width={size} height={size} />
            </button>
          );
        })}
        <div className="pointer-events-none absolute top-2 h-9 w-0.5 -translate-x-1/2 bg-spot" style={{ left: pct(replay.clock) }} />
        {[replay.start, mid, replay.end].map((t, i) => (
          <span key={i} className="absolute top-10 -translate-x-1/2 font-mono text-[10px] leading-4 text-fg-subtle" style={{ left: pct(t) }}>
            {clockOf(t).slice(0, 5)}
          </span>
        ))}
      </div>

      <p className="ml-auto flex shrink-0 gap-1 type-mono md:ml-0" aria-label={`Elapsed ${durationOf(replay.clock - replay.start)} of ${durationOf(span)}`}>
        <span className="text-fg">{durationOf(replay.clock - replay.start)}</span>
        <span className="text-fg-muted">/ {durationOf(span)}</span>
      </p>
    </div>
  );
}
