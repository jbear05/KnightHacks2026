// Outdoor mode on /live: before SPOT goes out, it checks today's forecast with Map & Sim's weather check
// (map-sim/src/sim/weather.ts, IliasCoder: Open-Meteo, free, no API key, only a city's coordinates are
// sent). Not safe = the mission isn't started. For demos the forecast can be swapped for editable demo
// weather, which is tagged as a what-if so nobody mistakes it for the real forecast.
import { PLACES, forecastVerdict, weatherAlert } from "@/map-sim/src/sim/index.ts";
import type { Forecast, Verdict } from "@/map-sim/src/sim/index.ts";
import type { FeedRow, LiveState, QueueItem } from "@/lib/replay";

export { PLACES, describeCode, fetchForecast, forecastVerdict, safetyMessage } from "@/map-sim/src/sim/index.ts";
export type { Forecast, Verdict } from "@/map-sim/src/sim/index.ts";

/** Orlando = UCF, home of KnightHacks (map-sim's first place). */
export const DEFAULT_PLACE = "Orlando, FL";

export type WeatherSource = "live" | "demo";

/** Conditions the demo editor offers, as WMO codes (map-sim's describeCode names them). */
export const DEMO_CODES = [0, 2, 45, 51, 63, 65, 66, 73, 95] as const;

export type DemoWeather = Pick<Forecast, "weatherCode" | "minC" | "maxC" | "rainMm" | "gustKmh">;

/** One-click demo days: one safe, one per reason SPOT stays in. */
export const DEMO_PRESETS: Record<string, { label: string; weather: DemoWeather }> = {
  sunny: {
    label: "Sunny day",
    weather: { weatherCode: 0, minC: 22, maxC: 31, rainMm: 0, gustKmh: 20 },
  },
  drizzle: {
    label: "Light rain",
    weather: { weatherCode: 63, minC: 18, maxC: 24, rainMm: 4, gustKmh: 30 },
  },
  storm: {
    label: "Thunderstorm",
    weather: { weatherCode: 95, minC: 24, maxC: 32, rainMm: 18, gustKmh: 55 },
  },
  snow: {
    label: "Snow and ice",
    weather: { weatherCode: 73, minC: -6, maxC: -1, rainMm: 8, gustKmh: 35 },
  },
  arctic: {
    label: "Arctic cold",
    weather: { weatherCode: 2, minC: -31, maxC: -24, rainMm: 0, gustKmh: 25 },
  },
  scorching: {
    label: "Scorching heat",
    weather: { weatherCode: 0, minC: 33, maxC: 47, rainMm: 0, gustKmh: 15 },
  },
  windy: {
    label: "Windy front",
    weather: { weatherCode: 2, minC: 15, maxC: 22, rainMm: 1, gustKmh: 75 },
  },
};
export const DEFAULT_PRESET = "storm";

/** The demo weather as a forecast for today, so map-sim's verdict reads it exactly like the real one. */
export function demoForecast(w: DemoWeather, date: string): Forecast {
  return {
    date,
    weatherCode: w.weatherCode,
    minC: Math.min(w.minC, w.maxC),
    maxC: Math.max(w.minC, w.maxC),
    rainMm: Math.max(0, w.rainMm),
    rainChancePct: null,
    gustKmh: w.gustKmh,
  };
}

export interface Outdoor {
  place: string;
  source: WeatherSource;
  forecast: Forecast;
  verdict: Verdict;
}

/** `?outdoor=1&place=Chicago, IL&wx=snow` on /live: outdoor mode, optionally with a demo preset. */
export function outdoorFromParams(outdoor?: string, place?: string, wx?: string) {
  return {
    on: outdoor === "1" || outdoor === "true" || (!!wx && wx in DEMO_PRESETS),
    place: place && place in PLACES ? place : DEFAULT_PLACE,
    source: (wx && wx in DEMO_PRESETS ? "demo" : "live") as WeatherSource,
    preset: wx && wx in DEMO_PRESETS ? wx : DEFAULT_PRESET,
  };
}

/** The verdict for a forecast, with map-sim's limits. */
export function outdoorOf(place: string, source: WeatherSource, forecast: Forecast): Outdoor {
  return { place, source, forecast, verdict: forecastVerdict(forecast) };
}

/**
 * Puts the weather check in the rail at the mission's start time: not safe tops the queue (the mission
 * doesn't start), safe is one feed row. Demo weather is tagged what-if; the real forecast "forecast".
 */
export function withForecast(live: LiveState, o: Outdoor, time: string): LiveState {
  const a = weatherAlert(o.place, o.forecast, o.verdict);
  const demo = o.source === "demo";
  const detail = demo ? a.detail.replace(/ \(Open-Meteo\)/, " (demo weather)") : a.detail;
  const key = `wx-${o.source}`;
  const row: FeedRow = {
    key,
    time,
    glyph: demo ? "sim" : "weather",
    text: a.title,
    detail: demo ? "· what-if" : "· forecast",
  };
  const items: QueueItem[] = o.verdict.safe
    ? []
    : [
        {
          kind: "sim",
          key,
          level: "critical",
          title: a.title,
          detail,
          time,
          tag: demo ? "what-if" : "forecast",
        },
      ];
  return {
    ...live,
    queue: [...items, ...live.queue],
    feed: [...live.feed, row],
  };
}
