// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FacilityMap } from "@/components/map/FacilityMap";
import mission from "@/lib/mock/mission-M014.json";
import { msOf, playedCount, timelineFromMission } from "@/lib/replay";
import type { MissionDetail } from "@/lib/types";
import { LiveMission } from "./LiveMission";

const m = mission as MissionDetail;
const timeline = timelineFromMission(m);
const plan = [...m.actions].sort((a, b) => a.sequence - b.sequence);

// jsdom has no canvas; the map's SPOT drawing skips itself when there is no 2D context.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
afterEach(cleanup);

const spot = (container: HTMLElement) => {
  const el = container.querySelector<HTMLElement>("[data-spot-to]")!;
  return { to: el.dataset.spotTo, mode: el.dataset.spotMode, xy: el.dataset.spotXy };
};

function mapAt(ts: string) {
  const clock = msOf(`2026-09-06T${ts}`);
  const events = timeline.slice(0, playedCount(timeline, clock));
  const { container, unmount } = render(<FacilityMap mode="live" events={events} plan={plan} clock={clock} floor="both" />);
  const out = { ...spot(container), events: events.length };
  unmount();
  return out;
}

describe("Live Mission replay sync", () => {
  it("shows SPOT inspecting WP07 on both the map and the status panel when opened paused at 02:15:00", () => {
    const { container } = render(<LiveMission mission={m} at="02:15:00" />);
    expect(spot(container)).toMatchObject({ to: "WP07", mode: "inspect" });
    const now = screen.getByRole("complementary", { name: "Mission status" });
    expect(now.textContent).toContain("Now · step 6 of 10");
    expect(now.textContent).toContain("Gauge reading");
    expect(now.textContent).toContain("Control Room Corridor (WP07)");
    expect(now.textContent).toContain("Started02:14:37");
  });

  it("moves SPOT between two seek times that have the same played events", () => {
    const early = mapAt("02:13:30");
    const late = mapAt("02:14:10");
    expect(early.events).toBe(late.events);
    expect(early).toMatchObject({ to: "WP07", mode: "walk" });
    expect(late).toMatchObject({ to: "WP07", mode: "walk" });
    expect(early.xy).not.toBe(late.xy);
  });

  it("seeks backwards and lands on the earlier step", () => {
    expect(mapAt("02:20:00")).toMatchObject({ to: "WP09" });
    expect(mapAt("02:03:00")).toMatchObject({ to: "WP09", mode: "walk" });
    expect(mapAt("02:01:00")).toMatchObject({ to: "WP05" });
  });

  it("labels the replay as reconstructed and says when the kit has no original log", () => {
    render(<LiveMission mission={{ ...m, in_replay: false }} />);
    expect(screen.getByText(/Reconstructed replay: rebuilt from this mission's recorded actions/)).toBeTruthy();
    expect(screen.getByText(/original replay log has no events for this mission/)).toBeTruthy();
  });
});

describe("Live Mission skipped steps", () => {
  it.each(["02:19:00", "02:20:30"])("keeps the status and map at WP01 when WP09 is skipped at %s", (at) => {
    const { container } = render(<LiveMission mission={m} at={at} scenario={{ heatC: 16, obstacle: false }} />);
    const now = screen.getByRole("complementary", { name: "Mission status" }).querySelector("section")!;
    expect(within(now).getByRole("heading", { name: "Step skipped" })).toBeTruthy();
    expect(now.textContent).toContain("Holding at Main Entrance (WP01)");
    expect(now.textContent).toContain("Turbine Hall South (WP09) is too hot");
    expect(within(now).queryByText("Started")).toBeNull();
    expect(within(now).queryByText("Arrives")).toBeNull();
    expect(container.querySelector('[aria-label="SPOT stopped near WP01"]')).toBeTruthy();
  });

  it("removes skipped findings from the rendered queue, feed and map legend", () => {
    const { container } = render(<LiveMission mission={m} at="02:26:00" scenario={{ heatC: 30, obstacle: false }} />);
    expect(screen.getByRole("list", { name: "Equipment findings so far" }).textContent).toBe("");
    expect(screen.queryByText("PANEL-212 serious finding")).toBeNull();
    expect(screen.queryByText("HX-217 serious finding")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open PANEL-212" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open HX-217" })).toBeNull();
    expect(container.querySelectorAll('[aria-label*=", serious finding recorded"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Heat wave" }));
    expect(screen.getByText("PANEL-212 serious finding")).toBeTruthy();
    expect(screen.getByText("HX-217 serious finding")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open PANEL-212" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open HX-217" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Equipment findings so far" }).textContent).toContain("PANEL-212");
    expect(container.querySelectorAll('[aria-label*=", serious finding recorded"]')).toHaveLength(2);
  });
});

describe("Live Mission cold snap and outdoor weather", () => {
  it("turning the cold snap on turns the heat wave off", () => {
    render(<LiveMission mission={m} at="02:15:00" scenario={{ heatC: 16, obstacle: false }} />);
    const heat = screen.getByRole("checkbox", { name: "Heat wave" }) as HTMLInputElement;
    const cold = screen.getByRole("checkbox", { name: "Cold snap" }) as HTMLInputElement;
    expect([heat.checked, cold.checked]).toEqual([true, false]);
    fireEvent.click(cold);
    expect([heat.checked, cold.checked]).toEqual([false, true]);
    expect(screen.getByText(/Air at WP07/)).toBeTruthy();
  });

  it("keeps SPOT in on a not-safe demo day and lets the operator edit the weather", () => {
    const { container } = render(
      <LiveMission mission={m} at="02:15:00" outdoor={{ on: true, place: "Chicago, IL", source: "demo", preset: "snow" }} />,
    );
    expect(screen.getByText(/Mission not started/)).toBeTruthy();
    const wx = screen.getByRole("group", { name: "Outdoor weather check" });
    expect(within(wx).getByText(/Not safe to go scan and scout today in Chicago, IL: snow or ice/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Play replay" }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("[data-spot-to]")?.getAttribute("data-spot-to")).not.toBe("WP07");
    const queue = screen.getByRole("heading", { name: "Attention queue" }).closest("section")!;
    expect(queue.textContent).toContain("Weather: not safe to go scan and scout");

    fireEvent.change(screen.getByRole("combobox", { name: "Load a demo day" }), { target: { value: "sunny" } });
    expect(within(wx).getByText("Safe to go scan and scout today in Chicago, IL.")).toBeTruthy();
    // safe again: SPOT sets out from the start
    expect(screen.queryByText(/Mission not started/)).toBeNull();
    expect(screen.getByRole("button", { name: "Pause replay" })).toBeTruthy();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Demo gusts in km/h" }), { target: { value: "90" } });
    expect(within(wx).getByText(/gusts up to 90 km\/h/)).toBeTruthy();
  });

  it("goes ahead with a note when the live forecast can't be reached", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    try {
      render(<LiveMission mission={m} at="02:15:00" outdoor={{ on: true, place: "Orlando, FL", source: "live", preset: "storm" }} />);
      expect(await screen.findByText(/Couldn't reach Open-Meteo \(offline\)/)).toBeTruthy();
      expect((screen.getByRole("button", { name: "Play replay" }) as HTMLButtonElement).disabled).toBe(false);
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("Live Mission component card", () => {
  it("opens map-sim's component health for a clicked stop and closes again", () => {
    render(<LiveMission mission={m} at="02:15:00" />);
    fireEvent.click(screen.getByRole("button", { name: /^WP09 Turbine Hall South,/ }));
    const card = screen.getByRole("region", { name: "Components at WP09" });
    expect(card.textContent).toContain("Turbine Hall South");
    expect(card.textContent).toMatch(/Health \d+\/100/);
    expect(card.textContent).toMatch(/left/);
    fireEvent.click(within(card).getByRole("button", { name: "Close components" }));
    expect(screen.queryByRole("region", { name: "Components at WP09" })).toBeNull();
  });
});
