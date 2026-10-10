"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "@/components/ui/Glyph";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  ACTION_LABEL,
  assetOf,
  FAILURE_LABEL,
  FAILURE_SHORT,
  floorOf,
  locationLabel,
  locationName,
  plural,
  readingValue,
  timeOf,
} from "@/lib/format";
import { floorChanges, readingFor } from "@/lib/report";
import type { Action, ActionType, MissionDetail } from "@/lib/types";

// Geometry of the Figma vine (public/figma/vine.svg): 1212 × 190, one wave per step,
// step centres at x = 60 + 121 × index. Missions in the data always have 10 steps.
const VINE_WIDTH = 1212;
const STEP_GAP = 121;
const FIRST_STEP_X = 60;

// NextEra's sample inspection photos (04_ASSETS). They illustrate the kind of check, not this exact step.
const SAMPLE_IMAGE: Record<ActionType, string> = {
  GAUGE_READING: "gauge_pressure_01.jpg",
  THERMAL_INSPECTION: "thermal_pump_bearing_01.jpg",
  ACOUSTIC_INSPECTION: "acoustic_valve_01.jpg",
  VISUAL_INSPECTION: "visual_pump_motor_01.jpg",
  NAVIGATION: "pipe_gallery_01.jpg",
};

function stepNote(m: MissionDetail, a: Action): string {
  if (a.failure_type) return `${a.location_id} · ${FAILURE_SHORT[a.failure_type]}`;
  const r = readingFor(m, a.action_id);
  // Walk steps only carry robot telemetry, so the vine shows just the stop.
  if (!r || a.action_type === "NAVIGATION") return a.location_id;
  return `${a.location_id} · ${readingValue(r)}`;
}

/** Step the report opens on: the one behind the top problem, else the first failure. */
function defaultStep(m: MissionDetail): number | null {
  const top = [...m.problems].sort((a, b) => b.priority - a.priority)[0];
  const action = (top && m.actions.find((a) => a.action_id === top.action_id)) || m.actions.find((a) => a.status === "FAILED");
  return action?.sequence ?? null;
}

export function RouteVine({ mission: m }: { mission: MissionDetail }) {
  const actions = [...m.actions].sort((a, b) => a.sequence - b.sequence);
  const [selected, setSelected] = useState<number | null>(() => defaultStep(m));
  const [scrollLeft, setScrollLeft] = useState(0);
  const stepRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const current = actions.find((a) => a.sequence === selected) ?? null;
  const index = current ? actions.indexOf(current) : -1;

  function close() {
    if (selected == null) return;
    const seq = selected;
    setSelected(null);
    stepRefs.current[seq]?.focus();
  }

  useEffect(() => {
    if (selected == null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section aria-labelledby="route-heading" className="flex flex-col gap-3 bg-surface px-5 py-6 sticker sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="route-heading" className="type-heading-lg">
          The route
        </h2>
        <p className="text-fg-subtle type-label">
          {plural(actions.length, "step")} · {plural(floorChanges(actions), "floor change")} · click a step for details
        </p>
      </div>

      <div
        className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin]"
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      >
        <div className="relative h-[190px]" style={{ width: VINE_WIDTH }}>
          <Image src="/figma/vine.svg" alt="" width={VINE_WIDTH} height={190} className="absolute top-0 left-0" priority />
          <ol aria-label="Mission steps in order">
            {actions.map((a, i) => {
              const failed = a.status === "FAILED";
              const isSelected = a.sequence === selected;
              return (
                <li
                  key={a.action_id}
                  className="absolute top-0 h-[190px] w-[120px]"
                  style={{ left: FIRST_STEP_X + STEP_GAP * i - 60 }}
                >
                  <time dateTime={a.timestamp} className="absolute top-5 left-0 w-full text-center text-fg-subtle type-mono">
                    {timeOf(a.timestamp, false)}
                  </time>
                  <button
                    type="button"
                    ref={(el) => {
                      stepRefs.current[a.sequence] = el;
                    }}
                    aria-expanded={isSelected}
                    aria-controls={isSelected ? "step-detail" : undefined}
                    aria-label={`Step ${a.sequence}: ${ACTION_LABEL[a.action_type]} at ${locationName(a.location_id)}, ${
                      failed ? "failed" : "succeeded"
                    }`}
                    onClick={() => setSelected(isSelected ? null : a.sequence)}
                    className="absolute top-[66px] left-[31px] flex size-[58px] items-center justify-center rounded-full"
                  >
                    {/* The step icon sits on the vine without a fill, exactly as drawn in Figma. */}
                    <Image src={failed ? "/figma/step-failed.svg" : "/figma/step-success.svg"} alt="" width={40} height={40} />
                    {isSelected && (
                      <Image src="/figma/selected-step-ring.svg" alt="" width={58} height={58} className="absolute inset-0" />
                    )}
                  </button>
                  <p className="absolute top-[128px] left-1/2 -translate-x-1/2 whitespace-nowrap type-body-strong">
                    {ACTION_LABEL[a.action_type]}
                  </p>
                  <p className="absolute top-[150px] left-1/2 -translate-x-1/2 whitespace-nowrap text-fg-muted type-body-sm">
                    {stepNote(m, a)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {current && (
        <StepDetail
          mission={m}
          action={current}
          pointerX={FIRST_STEP_X + STEP_GAP * index - scrollLeft}
          onClose={close}
        />
      )}
    </section>
  );
}

function StepDetail({
  mission: m,
  action: a,
  pointerX,
  onClose,
}: {
  mission: MissionDetail;
  action: Action;
  pointerX: number;
  onClose: () => void;
}) {
  const failed = a.status === "FAILED";
  const reading = readingFor(m, a.action_id);
  const asset = assetOf(a.asset_id);
  const floor = floorOf(a.location_id);
  const image = SAMPLE_IMAGE[a.action_type];
  const title = `Step ${a.sequence} · ${ACTION_LABEL[a.action_type]} at ${locationName(a.location_id)}`;

  return (
    <div
      id="step-detail"
      role="region"
      aria-label={`Step ${a.sequence} details`}
      className="relative flex flex-col gap-6 rounded-2xl border-2 border-line-strong bg-pollen-tint px-4 py-5 sm:px-6 lg:flex-row"
    >
      {pointerX > 0 && pointerX < 1180 && (
        <Image
          src="/figma/pointer.svg"
          alt=""
          width={20}
          height={11}
          className="absolute -top-4 hidden sm:block"
          // Absolute offsets start inside the 2px border, so shift by it to centre on the step.
          style={{ left: pointerX - 10 - 2 }}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <Glyph name={failed ? "blight" : "bloom"} size={32} />
          <h3 className="type-heading-md">{title}</h3>
          <StatusBadge status={a.status} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close step details"
            className="ml-auto rounded-pill border-2 border-line-strong bg-surface px-3 py-1.5 whitespace-pre type-button hover:bg-spot-tint"
          >
            {"Close  ✕"}
          </button>
        </div>

        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          <Fact label="Reading">
            {reading
              ? a.action_type === "NAVIGATION"
                ? `${readingValue(reading)} position confidence`
                : readingValue(reading)
              : "No reading taken"}
          </Fact>
          <Fact label="Quality">
            {!reading ? (
              <span className="text-fg-muted">Not applicable</span>
            ) : reading.quality === "QUESTIONABLE" ? (
              <>
                <Glyph name="check-sensor" size={18} />
                <span className="text-questionable">Questionable · check sensor</span>
              </>
            ) : (
              <>
                <Glyph name="bloom" size={18} />
                <span className="text-success">Good</span>
              </>
            )}
          </Fact>
          <Fact label="Asset">
            {a.asset_id}
            {asset && ` · ${asset.asset_name} · ${asset.criticality.toLowerCase()}`}
          </Fact>
          <Fact label="Location">
            {locationLabel(a.location_id)}
            {floor && ` · floor ${floor}`}
          </Fact>
          {failed && a.failure_type ? (
            <Fact label="What went wrong">
              <Image src="/figma/icon-x-circle-ink.svg" alt="" width={18} height={18} />
              <span className="text-failed">
                {FAILURE_LABEL[a.failure_type]}
                {a.duration_sec != null && ` after ${a.duration_sec} s`}
              </span>
            </Fact>
          ) : (
            <Fact label="Result">
              <Glyph name="bloom" size={18} />
              <span className="text-success">
                Succeeded{a.duration_sec != null && ` in ${a.duration_sec} s`}
              </span>
            </Fact>
          )}
          <Fact label="Time and battery">
            {timeOf(a.timestamp)}
            {a.battery_pct != null && ` · battery ${a.battery_pct}%`}
          </Fact>
        </dl>

        <Link
          href={`/assets/${encodeURIComponent(a.asset_id)}`}
          className="self-start text-success type-body-strong underline-offset-2 hover:underline"
        >
          Open asset {a.asset_id} →
        </Link>
      </div>

      <figure className="flex w-full max-w-[280px] shrink-0 flex-col gap-2">
        <Image
          src={`/inspections/${image}`}
          alt={`Sample ${ACTION_LABEL[a.action_type].toLowerCase()} photo from NextEra's kit`}
          width={280}
          height={190}
          className="h-[190px] w-[280px] rounded-xl border-2 border-line-strong object-cover"
        />
        <figcaption className="text-fg-muted type-body-sm">Sample inspection image · {image}</figcaption>
      </figure>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-button border-[1.5px] border-line bg-surface py-2.5 pr-2 pl-3.5">
      <dt className="text-fg-muted type-label">{label}</dt>
      <dd className="flex items-center gap-1.5 type-body-strong">{children}</dd>
    </div>
  );
}
