"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { msOf, playedCount } from "@/lib/replay";
import type { LiveEvent } from "@/lib/types";

export type Speed = 1 | 10 | 60;

export interface Replay {
  /** Events played so far, oldest first (the array the map and the feed read). */
  events: LiveEvent[];
  /** Events in the whole mission, for the scrubber. */
  total: number;
  /** Mission clock in ms (plant-local, see msOf). */
  clock: number;
  start: number;
  end: number;
  playing: boolean;
  speed: Speed;
  status: "playing" | "paused" | "ended";
  play: () => void;
  pause: () => void;
  setSpeed: (speed: Speed) => void;
  /** Jump to an event index (ReplayControlsProps.onSeek). */
  seek: (eventIndex: number) => void;
  /** Jump to a mission-clock time (the scrubber track). */
  seekTime: (clock: number) => void;
}

/**
 * The page's single replay. Owns the playback clock and plays every event at its own timestamp,
 * `speed` times faster than real time. The map, rail and replay bar all read from this one hook
 * (contracts/live-mission-right-rail.md: one stream per page).
 */
export function useReplay(timeline: LiveEvent[], opts: { speed?: Speed; autoplay?: boolean; startAt?: number } = {}): Replay {
  const start = timeline.length ? msOf(timeline[0].timestamp) : 0;
  const end = timeline.length ? msOf(timeline[timeline.length - 1].timestamp) : 0;
  const [clock, setClock] = useState(() => Math.min(end, Math.max(start, opts.startAt ?? start)));
  const [playing, setPlaying] = useState(opts.autoplay ?? true);
  const [speed, setSpeed] = useState<Speed>(opts.speed ?? 60);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : now - last.current;
      last.current = now;
      setClock((c) => {
        const next = Math.min(end, c + dt * speed);
        if (next >= end) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      last.current = null;
    };
  }, [playing, speed, end]);

  const played = playedCount(timeline, clock);
  const events = useMemo(() => timeline.slice(0, played), [timeline, played]);

  const play = useCallback(() => {
    // Pressing play at the end starts the mission over.
    setClock((c) => (c >= end ? start : c));
    setPlaying(true);
  }, [start, end]);
  const pause = useCallback(() => setPlaying(false), []);
  const seekTime = useCallback((t: number) => setClock(Math.min(end, Math.max(start, t))), [start, end]);
  const seek = useCallback(
    (i: number) => {
      const e = timeline[Math.min(timeline.length - 1, Math.max(0, i))];
      if (e) setClock(msOf(e.timestamp));
    },
    [timeline],
  );

  return {
    events,
    total: timeline.length,
    clock,
    start,
    end,
    playing,
    speed,
    status: playing ? "playing" : clock >= end ? "ended" : "paused",
    play,
    pause,
    setSpeed,
    seek,
    seekTime,
  };
}
