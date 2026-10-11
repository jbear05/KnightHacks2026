"use client";

// Screen A: Live Mission (Figma frame 4:3). One useReplay() drives the map, rail and replay bar.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { SEVERITY_LABEL } from "@/lib/format";
import { clockOf, deriveLive, msOf, stepSentence, timelineFromMission } from "@/lib/replay";
import { SERIOUS } from "@/lib/report";
import { DEFAULT_COLD_C, DEFAULT_HEAT_C, MAX_COLD_C, MAX_HEAT_C, NO_SCENARIO, scenarioState, withScenario, type Scenario } from "@/lib/scenarios";
import { DEFAULT_PLACE, DEFAULT_PRESET, DEMO_PRESETS, safetyMessage, withForecast, type WeatherSource } from "@/lib/weather";
import type { MissionDetail } from "@/lib/types";
import Image from "next/image";
import { FacilityMap, type MapLayers } from "@/components/map/FacilityMap";
import { ComponentCard } from "./ComponentCard";
import { MissionPicker, type MissionOption } from "./MissionPicker";
import { OutdoorWeather, useForecastCheck } from "./OutdoorWeather";
import { ReplayBar } from "./ReplayBar";
import { RightRail } from "./RightRail";
import { useReplay } from "./useReplay";

const LAYERS: { id: MapLayers; label: string }[] = [
  { id: "route", label: "Route" },
  { id: "findings", label: "Findings" },
  { id: "both", label: "Both" },
];

/** Outdoor mode as the page opens it (?outdoor=1&place=…&wx=storm). */
export interface OutdoorStart {
  on: boolean;
  place: string;
  source: WeatherSource;
  preset: string;
}

const NO_OUTDOOR: OutdoorStart = { on: false, place: DEFAULT_PLACE, source: "live", preset: DEFAULT_PRESET };
const noop = () => {};

/**
 * `at` ("02:14:00", plant time) opens the replay paused at that moment, e.g. to demo or screenshot a state.
 * `scenario` opens it with Map & Sim's what-ifs on (?heat=16&obstacle=1, ?cold=55).
 * `outdoor` opens it in outdoor mode, where SPOT checks today's weather before it goes out.
 */
export function LiveMission({
  mission,
  at,
  scenario: initial = NO_SCENARIO,
  outdoor: outdoorStart = NO_OUTDOOR,
  missions = [],
}: {
  mission: MissionDetail;
  at?: string;
  scenario?: Scenario;
  outdoor?: OutdoorStart;
  /** Every mission the operator can switch the replay to (the top bar's picker). */
  missions?: MissionOption[];
}) {
  const timeline = useMemo(() => timelineFromMission(mission), [mission]);
  const plan = useMemo(() => [...mission.actions].sort((a, b) => a.sequence - b.sequence), [mission]);
  const atMs = at ? msOf(`${mission.start_time.slice(0, 10)}T${at}`) : NaN;
  const startAt = Number.isFinite(atMs) ? atMs : undefined;
  const realReplay = useReplay(timeline, { speed: 60, autoplay: startAt === undefined, startAt });
  const [heatOn, setHeatOnState] = useState(initial.heatC > 0);
  const [heatC, setHeatC] = useState(initial.heatC || DEFAULT_HEAT_C);
  const [coldOn, setColdOnState] = useState(!heatOn && (initial.coldC ?? 0) > 0);
  const [coldC, setColdC] = useState(initial.coldC || DEFAULT_COLD_C);
  // Heat wave and cold snap set the same air temperature: turning one on turns the other off.
  const setHeatOn = (on: boolean) => {
    setHeatOnState(on);
    if (on) setColdOnState(false);
  };
  const setColdOn = (on: boolean) => {
    setColdOnState(on);
    if (on) setHeatOnState(false);
  };
  const [obstacle, setObstacle] = useState(initial.obstacle);

  const [outdoorOn, setOutdoorOn] = useState(outdoorStart.on);
  const [place, setPlace] = useState(outdoorStart.place);
  const [wxSource, setWxSource] = useState<WeatherSource>(outdoorStart.source);
  const [demoWx, setDemoWx] = useState((DEMO_PRESETS[outdoorStart.preset] ?? DEMO_PRESETS[DEFAULT_PRESET]).weather);
  const { check, recheck } = useForecastCheck(outdoorOn, place, wxSource, demoWx, mission.start_time.slice(0, 10));
  const outdoor = check.status === "ok" ? check.outdoor : null;
  // Not safe to go out (map-sim's verdict): the mission isn't started, so the replay is held at the start.
  const grounded = outdoor && !outdoor.verdict.safe ? safetyMessage(outdoor.place, outdoor.verdict) : null;
  // Once it's safe again (the weather was edited or rechecked), SPOT sets out from the start.
  const { pause, play, seekTime, start: replayStart } = realReplay;
  const wasGrounded = useRef(false);
  useEffect(() => {
    if (grounded) {
      pause();
      seekTime(replayStart);
    } else if (wasGrounded.current) play();
    wasGrounded.current = !!grounded;
  }, [grounded, pause, play, seekTime, replayStart]);
  const replay = grounded
    ? { ...realReplay, events: [], clock: realReplay.start, playing: false, status: "paused" as const, play: noop, seek: noop, seekTime: noop }
    : realReplay;

  const base = deriveLive(mission, replay.events, replay.clock);
  const cur = base.current;
  const sim = scenarioState(
    mission.mission_id,
    { heatC: heatOn ? heatC : 0, coldC: coldOn ? coldC : 0, obstacle },
    new Set(base.results.map((r) => r.action.action_id)),
    cur ? { action_id: cur.action.action_id, location_id: cur.action.location_id, progress: cur.progress, inspecting: cur.phase === "inspecting" } : null,
    base.ended,
    clockOf(replay.clock),
  );
  const withSim = withScenario(base, sim);
  const live = outdoor ? withForecast(withSim, outdoor, mission.start_time.slice(11, 19)) : withSim;
  const [layers, setLayers] = useState<MapLayers>("both");
  const [selected, setSelected] = useState<string | null>(null);

  const results = useMemo(() => new Map(live.results.map((r) => [r.action.action_id, r.ok])), [live.results]);
  const serious = live.problems.filter((p) => SERIOUS.includes(p.severity)).sort((a, b) => b.priority - a.priority);
  const alertLabels = Object.fromEntries([...serious].reverse().map((p) => [p.location_id, SEVERITY_LABEL[p.severity]]));

  const subtitle = grounded
    ? "Mission not started: SPOT stays in, it's not safe to go out today"
    : live.current
      ? stepSentence(live.current, plan.length)
      : live.ended
        ? `Mission finished · ${live.succeeded} of ${plan.length} steps succeeded`
        : "SPOT is waiting at the Main Entrance (WP01)";

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-6 md:px-6">
      <LiveTopBar mission={mission} missions={missions} live={live} status={replay.status} speed={replay.speed} />

      <div className="grid gap-6 lg:min-h-[676px] lg:grid-cols-[minmax(0,1fr)_424px]">
        <section aria-labelledby="map-heading" className="sticker flex flex-col overflow-hidden bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-3 px-[18px] pt-4">
            <div className="flex flex-col gap-0.5">
              <h1 id="map-heading" className="font-display text-[26px] leading-8 font-bold">
                Facility · floors 1 and 2
              </h1>
              <p className="text-fg-muted type-body-sm">{subtitle}</p>
            </div>
            <div role="radiogroup" aria-label="Map layers" className="flex overflow-hidden lg:mr-[14px] rounded-pill border-[1.5px] border-line-strong">
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={layers === l.id}
                  onClick={() => setLayers(l.id)}
                  className={`px-[9px] py-[5px] type-mono ${layers === l.id ? "bg-raised text-fg" : "bg-surface text-fg-muted hover:bg-raised/60"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="What-if scenarios" className="flex w-full min-h-7 flex-wrap items-center gap-x-4 gap-y-1 type-body-sm">
              <span className="text-fg-muted type-label">What-if</span>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={heatOn} onChange={(e) => setHeatOn(e.target.checked)} className="size-4 accent-[var(--color-high)]" />
                Heat wave
              </label>
              <input
                type="range"
                min={1}
                max={MAX_HEAT_C}
                value={heatC}
                disabled={!heatOn}
                onChange={(e) => setHeatC(Number(e.target.value))}
                aria-label="Heat wave strength"
                aria-valuetext={`plus ${heatC} degrees Celsius`}
                className="w-24 accent-[var(--color-high)] disabled:opacity-40"
              />
              <span className={`type-mono ${heatOn ? "" : "text-fg-subtle"}`}>+{heatC}°C</span>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={coldOn} onChange={(e) => setColdOn(e.target.checked)} className="size-4 accent-[var(--color-high)]" />
                Cold snap
              </label>
              <input
                type="range"
                min={1}
                max={MAX_COLD_C}
                value={coldC}
                disabled={!coldOn}
                onChange={(e) => setColdC(Number(e.target.value))}
                aria-label="Cold snap strength"
                aria-valuetext={`minus ${coldC} degrees Celsius`}
                className="w-24 accent-[var(--color-high)] disabled:opacity-40"
              />
              <span className={`type-mono ${coldOn ? "" : "text-fg-subtle"}`}>−{coldC}°C</span>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={obstacle} onChange={(e) => setObstacle(e.target.checked)} className="size-4 accent-[var(--color-high)]" />
                Obstacle at the dock
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={outdoorOn} onChange={(e) => setOutdoorOn(e.target.checked)} className="size-4 accent-[var(--color-high)]" />
                Outdoors: check the weather
              </label>
              {sim.airC !== null && cur && (
                <span className="text-fg-muted">
                  Air at {cur.action.location_id}{" "}
                  <span className={`type-mono ${sim.airC > 45 || sim.airC < -20 ? "text-critical" : sim.airC > 40 || sim.airC < -15 ? "text-high" : "text-fg"}`}>
                    {sim.airC}°C
                  </span>
                </span>
              )}
            </div>
            {outdoorOn && (
              <OutdoorWeather
                place={place}
                setPlace={setPlace}
                source={wxSource}
                setSource={setWxSource}
                demo={demoWx}
                setDemo={setDemoWx}
                check={check}
                recheck={recheck}
              />
            )}
          </div>

          <div className="-mx-[2px] mt-4">
            <FacilityMap
              mode="live"
              events={replay.events}
              plan={plan}
              clock={replay.clock}
              floor="both"
              alertLocationIds={serious.map((p) => p.location_id)}
              alertLabels={alertLabels}
              selectedLocationId={selected}
              onSelectLocation={(id) => setSelected((s) => (s === id ? null : id))}
              layers={layers}
              obstacle={obstacle}
              skipped={[...sim.skipped]}
            />
          </div>

          {selected && (
            <div className="px-[18px]">
              <ComponentCard stopId={selected} onClose={() => setSelected(null)} />
            </div>
          )}

          <div className="mt-auto flex flex-col px-[18px] pb-[18px]">
            <ul className="flex min-h-9 flex-wrap items-center gap-x-5 gap-y-1" aria-label="Equipment findings so far">
              {serious.map((p) => (
                <li key={p.anomaly_id} className="flex items-center gap-1.5">
                  <SeverityBadge severity={p.severity} />
                  <span className="text-high type-body-sm">
                    {p.asset_id} · {p.location_id} · priority {p.priority}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-fg-muted type-body-sm">
              Reconstructed replay: rebuilt from this mission&apos;s recorded actions, timestamps and findings.{" "}
              {mission.in_replay
                ? "The kit's original replay log also covers this mission; walking paths between stops are simulated."
                : "The kit's original replay log has no events for this mission, so this playback comes from the mission records only."}{" "}
              Walks follow the route grid around walls; SPOT hops between the two stairwells.
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 type-body-sm" aria-label="Map legend">
              <Legend src="/figma/step-success-sm.svg" label="Succeeded step" />
              <Legend src="/figma/step-failed-sm.svg" label="Failed step" />
              <Legend src="/figma/icon-alert-triangle-high.svg" label="Equipment finding" />
              <Legend src="/figma/glyph-spot.svg" label="SPOT" />
            </ul>
          </div>
        </section>

        <RightRail live={live} total={plan.length} clock={replay.clock} start={replay.start} missionId={mission.mission_id} />
      </div>

      <ReplayBar replay={replay} plan={plan} results={results} locked={grounded ? "SPOT isn't going out today: not safe" : undefined} />
    </div>
  );
}

function Legend({ src, label }: { src: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <Image src={src} alt="" width={16} height={16} />
      {label}
    </li>
  );
}

/** Mission picker, replay state and run tally, rendered into the shared top bar's slot. */
function LiveTopBar({
  mission,
  missions,
  live,
  status,
  speed,
}: {
  mission: MissionDetail;
  missions: MissionOption[];
  live: ReturnType<typeof deriveLive>;
  status: "playing" | "paused" | "ended";
  speed: number;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("topbar-slot")), []);
  if (!slot) return null;
  const state = status === "playing" ? `Reconstructed replay ${speed}×` : status === "paused" ? "Replay paused" : "Replay finished";
  return createPortal(
    <>
      <MissionPicker current={mission} missions={missions} />
      <span className="hidden items-center gap-2 type-mono md:flex">
        <span className={`size-2 rounded-full ${status === "playing" ? "bg-line-strong motion-safe:animate-pulse" : "bg-fg-subtle"}`} aria-hidden />
        {state}
      </span>
      <p className="ml-auto hidden items-center gap-4 lg:flex xl:mr-[79px]" aria-label={`This run: ${live.succeeded} succeeded, ${live.failed} failed, ${live.toGo} to go`}>
        <span className="text-fg-muted type-mono">This run</span>
        <Tally n={live.succeeded} label="succeeded" tone="text-success" />
        <Tally n={live.failed} label="failed" tone="text-failed" />
        <Tally n={live.toGo} label="to go" tone="text-fg-muted" />
      </p>
    </>,
    slot,
  );
}

function Tally({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-display text-[18px] leading-6 font-bold">{n}</span>
      <span className={`type-mono ${tone}`}>{label}</span>
    </span>
  );
}
