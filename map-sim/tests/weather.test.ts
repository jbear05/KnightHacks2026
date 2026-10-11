/**
 * Tests for the weather check: today's forecast (Open-Meteo) -> safe or not safe
 * to go scan and scout. No network: fetch is faked.
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  forecastVerdict, parseForecast, fetchForecast, forecastUrl, safetyMessage, weatherAlert,
} from "../src/sim/weather.ts";
import type { Forecast } from "../src/sim/weather.ts";

/** A real Open-Meteo answer (Orlando, 2026-10-10), trimmed to what we read. */
const ORLANDO = {
  latitude: 28.600586, longitude: -81.18527, timezone: "America/New_York",
  daily: {
    time: ["2026-10-10"], weather_code: [95], temperature_2m_max: [32.6], temperature_2m_min: [25.8],
    precipitation_sum: [6.9], precipitation_probability_max: [55], wind_gusts_10m_max: [30.6],
  },
};
const day = (o: Partial<Forecast>): Forecast =>
  ({ date: "2026-10-10", weatherCode: 0, maxC: 25, minC: 15, rainMm: 0, rainChancePct: 0, gustKmh: 10, ...o });

describe("reading the forecast", () => {
  test("parses Open-Meteo's daily forecast", () => {
    assert.deepEqual(parseForecast(ORLANDO), {
      date: "2026-10-10", weatherCode: 95, maxC: 32.6, minC: 25.8, rainMm: 6.9, rainChancePct: 55, gustKmh: 30.6,
    });
    assert.throws(() => parseForecast({ hourly: {} }), /Unexpected forecast format/);
  });

  test("fetches from Open-Meteo (no API key) and reports HTTP errors", async () => {
    let asked = "";
    const ok = (async (url: string) => { asked = url; return new Response(JSON.stringify(ORLANDO)); }) as typeof fetch;
    const f = await fetchForecast(28.6, -81.2, ok);
    assert.equal(f.weatherCode, 95);
    assert.ok(asked.startsWith("https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=-81.2"));
    assert.ok(!/key/i.test(asked));
    const down = (async () => new Response("busy", { status: 503 })) as typeof fetch;
    await assert.rejects(fetchForecast(1, 2, down), /503/);
    assert.ok(forecastUrl(1, 2).includes("forecast_days=1"));
  });
});

describe("safe or not safe to go scan and scout", () => {
  test("thunderstorms (the real Orlando forecast): not safe, and the message says why", () => {
    const f = parseForecast(ORLANDO), v = forecastVerdict(f);
    assert.equal(v.safe, false);
    assert.match(safetyMessage("Orlando, FL", v), /^Not safe to go scan and scout today in Orlando, FL: thunderstorms/);
    const a = weatherAlert("Orlando, FL", f, v);
    assert.equal(a.level, "critical");
    assert.match(a.detail, /Open-Meteo.*Thunderstorm, 26-33°C/);
  });

  test("a fine day: safe", () => {
    const v = forecastVerdict(day({ weatherCode: 1 }));
    assert.equal(v.safe, true);
    assert.deepEqual(v.reasons, []);
    assert.equal(safetyMessage("Denver, CO", v), "Safe to go scan and scout today in Denver, CO.");
    assert.equal(weatherAlert("Denver, CO", day({}), v).level, "info");
  });

  test("each kind of day", () => {
    const cases: [Partial<Forecast>, boolean][] = [
      [{ weatherCode: 0 }, true],
      [{ weatherCode: 61, rainMm: 3 }, true],               // light rain: SPOT is rated for it
      [{ weatherCode: 65, rainMm: 25 }, false],             // heavy rain
      [{ weatherCode: 63, rainMm: 14 }, false],             // more rain than our limit
      [{ weatherCode: 71, minC: -5, maxC: 0 }, false],      // snow
      [{ weatherCode: 0, minC: -25, maxC: -12 }, false],    // below -20C
      [{ weatherCode: 1, maxC: 47 }, false],                // above 45C
      [{ weatherCode: 3, gustKmh: 75 }, false],             // gusts above our limit
    ];
    for (const [f, safe] of cases) {
      const v = forecastVerdict(day(f));
      assert.equal(v.safe, safe, JSON.stringify(f));
      assert.equal(v.reasons.length === 0, safe, JSON.stringify(f));
    }
  });
});
