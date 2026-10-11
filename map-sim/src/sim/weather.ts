/**
 * Is it safe for SPOT to go out and scan today? Asks Open-Meteo (free, no API
 * key; only a place's coordinates are sent) for today's forecast and turns it
 * into one message: safe or not safe to go scan and scout.
 *
 * Limits come from the SPOT user guide in the challenge kit where it has them
 * (light rain only, operating -20C to 45C, slippery surfaces can make it fall);
 * the rest are marked as our assumption.
 */
import type { Alert } from "./scenario.ts";

export const WEATHER = {
  /** Forecast gusts above this are not safe (our assumption; the guide gives no wind limit). */
  maxGustKmh: 60,
  /** Forecast rain above this (mm/day) is more than "light rain" (our assumption). */
  maxRainMm: 10,
  minC: -20,              // SPOT user guide: operating temperature -20C to 45C
  maxC: 45,
};

/** Today's forecast, the fields we use from Open-Meteo's daily forecast. */
export interface Forecast {
  date: string;
  weatherCode: number;        // WMO code
  maxC: number;
  minC: number;
  rainMm: number;
  rainChancePct: number | null;
  gustKmh: number | null;
}

export interface Verdict {
  safe: boolean;
  reasons: string[];          // why it isn't safe (empty when it is)
  summary: string;            // "Thunderstorm, 26-33°C, 6.9 mm rain (55% chance), gusts 31 km/h"
}

/** WMO weather codes, as Open-Meteo documents them. */
export function describeCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return code >= 56 ? "Freezing drizzle" : "Drizzle";
  if (code >= 61 && code <= 67) return code >= 66 ? "Freezing rain" : code === 65 ? "Heavy rain" : "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return code === 82 ? "Violent rain showers" : "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return `Weather code ${code}`;
}

/** Is it safe for SPOT to go out today? */
export function forecastVerdict(f: Forecast): Verdict {
  const reasons: string[] = [];
  const c = f.weatherCode;
  const thunder = c >= 95;
  const ice = (c >= 56 && c <= 57) || (c >= 66 && c <= 67) || (c >= 71 && c <= 77) || c === 85 || c === 86;
  const heavyRain = c === 65 || c === 82 || f.rainMm > WEATHER.maxRainMm;

  if (thunder) reasons.push("thunderstorms: more than the light rain SPOT is rated for (SPOT user guide), plus lightning");
  if (ice) reasons.push("snow or ice: slippery surfaces can make SPOT fall (SPOT user guide)");
  if (heavyRain && !thunder) reasons.push(`heavy rain (${f.rainMm} mm): SPOT is only rated for light rain (SPOT user guide)`);
  if (f.maxC > WEATHER.maxC) reasons.push(`up to ${f.maxC}°C: above SPOT's 45°C limit (SPOT user guide)`);
  if (f.minC < WEATHER.minC) reasons.push(`down to ${f.minC}°C: below SPOT's -20°C limit (SPOT user guide)`);
  if (f.gustKmh !== null && f.gustKmh > WEATHER.maxGustKmh) reasons.push(`gusts up to ${f.gustKmh} km/h (our limit ${WEATHER.maxGustKmh} km/h)`);

  const summary = `${describeCode(c)}, ${Math.round(f.minC)}-${Math.round(f.maxC)}°C, ${f.rainMm} mm rain` +
    (f.rainChancePct !== null ? ` (${f.rainChancePct}% chance)` : "") + (f.gustKmh !== null ? `, gusts ${Math.round(f.gustKmh)} km/h` : "");
  return { safe: reasons.length === 0, reasons, summary };
}

/** SPOT's message for the day, e.g. "Safe to go scan and scout today in Orlando, FL." */
export function safetyMessage(place: string, v: Verdict): string {
  return v.safe
    ? `Safe to go scan and scout today in ${place}.`
    : `Not safe to go scan and scout today in ${place}: ${v.reasons.join("; ")}.`;
}

/** The message as an alert (info when safe, critical when not). */
export function weatherAlert(place: string, f: Forecast, v: Verdict): Alert {
  return {
    id: `wx-${f.date}-${place}`, level: v.safe ? "info" : "critical", simulated: false, location_id: null, action_id: null,
    title: v.safe ? "Weather: safe to go scan and scout" : "Weather: not safe to go scan and scout",
    detail: `${safetyMessage(place, v)} Forecast for ${f.date} (Open-Meteo): ${v.summary}.`,
  };
}

/** Open-Meteo daily forecast URL for today at a place (free, no API key). */
export function forecastUrl(lat: number, lon: number): string {
  const daily = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max";
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${daily}&timezone=auto&forecast_days=1`;
}

/** Pick today's values out of an Open-Meteo response. Throws on anything unexpected. */
export function parseForecast(json: unknown): Forecast {
  const d = (json as { daily?: Record<string, unknown[]> })?.daily;
  const first = (k: string) => (Array.isArray(d?.[k]) ? d![k][0] : undefined);
  const num = (k: string) => { const v = first(k); return typeof v === "number" ? v : null; };
  const code = num("weather_code"), max = num("temperature_2m_max"), min = num("temperature_2m_min");
  if (typeof first("time") !== "string" || code === null || max === null || min === null) {
    throw new Error("Unexpected forecast format from Open-Meteo");
  }
  return {
    date: first("time") as string, weatherCode: code, maxC: max, minC: min,
    rainMm: num("precipitation_sum") ?? 0,
    rainChancePct: num("precipitation_probability_max"),
    gustKmh: num("wind_gusts_10m_max"),
  };
}

/** Fetch today's forecast. `fetchFn` is injectable so tests never touch the network. */
export async function fetchForecast(lat: number, lon: number, fetchFn: typeof fetch = fetch): Promise<Forecast> {
  const res = await fetchFn(forecastUrl(lat, lon));
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  return parseForecast(await res.json());
}

/** A few places to try the forecast with (Orlando = UCF, home of KnightHacks). */
export const PLACES: Record<string, { lat: number; lon: number }> = {
  "Orlando, FL": { lat: 28.6, lon: -81.2 },
  "Miami, FL": { lat: 25.76, lon: -80.19 },
  "Chicago, IL": { lat: 41.88, lon: -87.63 },
  "Denver, CO": { lat: 39.74, lon: -104.99 },
  "Phoenix, AZ": { lat: 33.45, lon: -112.07 },
  "Anchorage, AK": { lat: 61.22, lon: -149.9 },
};
