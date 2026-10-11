// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MissionPicker, type MissionOption } from "./MissionPicker";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => {
  cleanup();
  push.mockReset();
  window.history.replaceState(null, "", "/");
});

const m = (n: number, extra: Partial<MissionOption> = {}): MissionOption => ({
  mission_id: `M0${n}`,
  mission_name: `Autowalk Inspection Route ${n}`,
  scenario: "BASELINE",
  configuration_version: "V1",
  ...extra,
});

describe("MissionPicker", () => {
  it("lists every mission with the current one selected", () => {
    render(<MissionPicker current={m(14)} missions={[m(13), m(14), m(25, { configuration_version: "V2" })]} />);
    const select = screen.getByLabelText<HTMLSelectElement>("Mission to replay");
    expect(select.value).toBe("M014");
    expect([...select.options].map((o) => o.text)).toEqual([
      "M013 · Autowalk Route 13 · Baseline V1",
      "M014 · Autowalk Route 14 · Baseline V1",
      "M025 · Autowalk Route 25 · Baseline V2",
    ]);
  });

  it("switches the replay, keeping the what-ifs and dropping the old mission's time", () => {
    window.history.replaceState(null, "", "/live?mission=M014&at=02:15:00&heat=16&obstacle=1");
    render(<MissionPicker current={m(14)} missions={[m(14), m(25)]} />);
    fireEvent.change(screen.getByLabelText("Mission to replay"), { target: { value: "M025" } });
    expect(push).toHaveBeenCalledWith("/live?mission=M025&heat=16&obstacle=1");
  });

  it("still shows the current mission when the list failed to load", () => {
    render(<MissionPicker current={m(14)} missions={[]} />);
    expect(screen.getByLabelText<HTMLSelectElement>("Mission to replay").options).toHaveLength(1);
  });
});
