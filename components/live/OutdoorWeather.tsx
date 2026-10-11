"use client";

// Outdoor mode's weather check on /live (lib/weather.ts): today's real forecast from Open-Meteo, or
// editable demo weather. Map & Sim's verdict decides whether SPOT goes out.
import { useCallback, useEffect, useState } from "react";
import {
  DEMO_CODES,
  DEMO_PRESETS,
  PLACES,
  demoForecast,
  describeCode,
  fetchForecast,
  outdoorOf,
  safetyMessage,
  type DemoWeather,
  type Forecast,
  type Outdoor,
  type WeatherSource,
} from "@/lib/weather";

export type ForecastCheck =
  | { status: "off" }
  | { status: "checking" }
  | { status: "ok"; outdoor: Outdoor }
  | { status: "error"; message: string };

// One real forecast per city per page visit: switching missions or toggling doesn't re-ask.
const cache = new Map<string, Forecast>();

/** The weather check for outdoor mode. Live asks Open-Meteo once per city (recheck asks again). */
export function useForecastCheck(on: boolean, place: string, source: WeatherSource, demo: DemoWeather, date: string) {
  const [live, setLive] = useState<{
    place: string;
    forecast?: Forecast;
    error?: string;
  } | null>(null);
  const [nonce, setNonce] = useState(0);
  const wantLive = on && source === "live";

  useEffect(() => {
    if (!wantLive) return;
    const hit = nonce === 0 ? cache.get(place) : undefined;
    if (hit) {
      setLive({ place, forecast: hit });
      return;
    }
    let stale = false;
    setLive(null);
    const { lat, lon } = PLACES[place];
    fetchForecast(lat, lon)
      .then((f) => {
        cache.set(place, f);
        if (!stale) setLive({ place, forecast: f });
      })
      .catch((e: unknown) => {
        if (!stale) setLive({ place, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      stale = true;
    };
  }, [wantLive, place, nonce]);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  let check: ForecastCheck;
  if (!on) check = { status: "off" };
  else if (source === "demo")
    check = {
      status: "ok",
      outdoor: outdoorOf(place, "demo", demoForecast(demo, date)),
    };
  else if (!live || live.place !== place) check = { status: "checking" };
  else if (live.forecast) check = { status: "ok", outdoor: outdoorOf(place, "live", live.forecast) };
  else check = { status: "error", message: live.error ?? "no answer" };
  return { check, recheck };
}

const field = "rounded-pill border-[1.5px] border-line-strong bg-surface px-2 py-0.5 type-mono";

/** Outdoor mode's second row: city, live forecast or demo weather, and SPOT's verdict. */
export function OutdoorWeather({
  place,
  setPlace,
  source,
  setSource,
  demo,
  setDemo,
  check,
  recheck,
}: {
  place: string;
  setPlace: (p: string) => void;
  source: WeatherSource;
  setSource: (s: WeatherSource) => void;
  demo: DemoWeather;
  setDemo: (d: DemoWeather) => void;
  check: ForecastCheck;
  recheck: () => void;
}) {
  const num = (k: keyof DemoWeather, label: string, unit: string, min: number, max: number) => (
    <label className="flex items-center gap-1">
      <span className="text-fg-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={demo[k] ?? 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) setDemo({ ...demo, [k]: Math.min(max, Math.max(min, v)) });
        }}
        aria-label={`Demo ${label.toLowerCase()} in ${unit}`}
        className={`${field} w-16`}
      />
      <span className="text-fg-muted type-mono">{unit}</span>
    </label>
  );

  return (
    <div
      role="group"
      aria-label="Outdoor weather check"
      className="flex w-full flex-col gap-1.5 rounded-card border-[1.5px] border-line bg-raised/40 px-3 py-2 type-body-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label className="flex items-center gap-1.5">
          <span className="text-fg-muted">Check today&apos;s weather in</span>
          <select value={place} onChange={(e) => setPlace(e.target.value)} aria-label="City for the weather check" className={field}>
            {Object.keys(PLACES).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label="Weather data" className="flex overflow-hidden rounded-pill border-[1.5px] border-line-strong">
          {(
            [
              ["live", "Live forecast"],
              ["demo", "Demo weather"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={source === id}
              onClick={() => setSource(id)}
              className={`px-[9px] py-[3px] type-mono ${source === id ? "bg-raised text-fg" : "bg-surface text-fg-muted hover:bg-raised/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {source === "live" && (
          <button
            type="button"
            onClick={recheck}
            className="rounded-pill border-[1.5px] border-line-strong bg-surface px-2.5 py-[3px] type-mono hover:bg-raised/60"
          >
            Check now
          </button>
        )}
      </div>

      {source === "demo" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <select
            value=""
            onChange={(e) => e.target.value && setDemo(DEMO_PRESETS[e.target.value].weather)}
            aria-label="Load a demo day"
            className={field}
          >
            <option value="">Load a demo day…</option>
            {Object.entries(DEMO_PRESETS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={demo.weatherCode}
            onChange={(e) => setDemo({ ...demo, weatherCode: Number(e.target.value) })}
            aria-label="Demo sky"
            className={field}
          >
            {DEMO_CODES.map((c) => (
              <option key={c} value={c}>
                {describeCode(c)}
              </option>
            ))}
          </select>
          {num("minC", "Low", "°C", -60, 60)}
          {num("maxC", "High", "°C", -60, 60)}
          {num("rainMm", "Rain", "mm", 0, 200)}
          {num("gustKmh", "Gusts", "km/h", 0, 250)}
        </div>
      )}

      <Verdict check={check} />
    </div>
  );
}

function Verdict({ check }: { check: ForecastCheck }) {
  if (check.status === "off") return null;
  if (check.status === "checking")
    return (
      <p className="text-fg-muted" aria-live="polite">
        Checking today&apos;s forecast…
      </p>
    );
  if (check.status === "error")
    return (
      <p className="text-fg-muted" aria-live="polite">
        Couldn&apos;t reach Open-Meteo ({check.message}), so SPOT goes ahead without a forecast. Switch to demo weather to try a day.
      </p>
    );
  const { outdoor: o } = check;
  const tag = o.source === "demo" ? "demo weather" : `Open-Meteo, ${o.forecast.date}`;
  return (
    <p aria-live="polite" className={o.verdict.safe ? "text-success" : "text-critical"}>
      <span className="type-body-strong">{safetyMessage(o.place, o.verdict)}</span>{" "}
      <span className="text-fg-muted">
        {o.verdict.summary} ({tag}).
      </span>
    </p>
  );
}
