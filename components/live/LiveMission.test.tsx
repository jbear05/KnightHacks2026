// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import mission from "@/lib/mock/mission-M014.json";
import type { MissionDetail } from "@/lib/types";
import { LiveMission } from "./LiveMission";

const m = mission as MissionDetail;
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
afterEach(cleanup);

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
    expect(screen.queryByText("PANEL-212 needs review")).toBeNull();
    expect(screen.queryByText("HX-217 needs review")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open PANEL-212" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open HX-217" })).toBeNull();
    expect(container.querySelectorAll('[aria-label*=", needs review"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Heat wave" }));
    expect(screen.getByText("PANEL-212 needs review")).toBeTruthy();
    expect(screen.getByText("HX-217 needs review")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open PANEL-212" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open HX-217" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Equipment findings so far" }).textContent).toContain("PANEL-212");
    expect(container.querySelectorAll('[aria-label*=", needs review"]')).toHaveLength(2);
  });
});
