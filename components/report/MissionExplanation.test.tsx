// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mission from "@/lib/mock/mission-M014.json";
import { buildMissionSummaryInput } from "@/lib/mission-summary-input";
import { summaryReferencesOnlyRecordNumbersAndIds } from "@/lib/mission-summary-grounding";
import type { MissionDetail } from "@/lib/types";
import { MissionExplanation } from "./MissionExplanation";

// The real summarizer and grounding check run; only the model itself is replaced.
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@huggingface/transformers", () => ({ pipeline: vi.fn(async () => generate) }));

const m = mission as MissionDetail;
// Every number and ID here is in M014's model input, but on the wrong fields (22 is the end battery,
// 3 is the failed-step count). The grounding check cannot see that.
const SWAPPED = "M014 had 22 failed actions and battery ended at 3%.";

afterEach(cleanup);
beforeEach(() => generate.mockReset());

const records = () => screen.getByRole("list", { name: "Mission summary from the records" }).textContent ?? "";

async function draft() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
  });
}

describe("MissionExplanation", () => {
  it("shows the record summary immediately, with M014's three failed steps and two serious findings", () => {
    render(<MissionExplanation mission={m} />);
    const text = records();
    expect(text).toContain("M014 completed its route");
    expect(text).toContain("Battery went from 68% to 22%.");
    expect(text).toContain(
      "3 of 10 steps failed: step 2 gauge reading at WP09 (sensor timeout); step 3 gauge reading at WP06 (sensor timeout); step 4 walk to stop at WP06 (lost robot position).",
    );
    expect(text).toContain("2 serious findings recorded: high gauge out of range on HX-217 at WP06 (priority 12); high gauge out of range on PANEL-212 at WP09 (priority 9).");
    expect(text).toContain("1 equipment reading (HX-217 128.8 psi) and 1 robot localization reading (navigation telemetry, not equipment health)");
    expect(generate).not.toHaveBeenCalled();
  });

  it("keeps the record summary when the model fails", async () => {
    generate.mockImplementationOnce(async () => {
      throw new Error("network down");
    });
    render(<MissionExplanation mission={m} />);
    const before = records();
    await draft();
    expect(screen.getByText(/AI drafting failed \(network down\)/)).toBeTruthy();
    expect(records()).toBe(before);
  });

  it("never lets known numbers on the wrong fields replace the record summary", async () => {
    // The membership check passes this text: it only proves the numbers exist somewhere in the input.
    expect(summaryReferencesOnlyRecordNumbersAndIds(SWAPPED, buildMissionSummaryInput(m))).toBe(true);
    generate.mockResolvedValue([{ summary_text: SWAPPED }]);
    render(<MissionExplanation mission={m} />);
    const before = records();
    await draft();
    // The draft is shown only as secondary wording, with the limit spelled out; the records are unchanged.
    expect(screen.getByText(SWAPPED).tagName).toBe("BLOCKQUOTE");
    expect(screen.getByText(/cannot tell whether a number is attached to the right field/)).toBeTruthy();
    expect(records()).toBe(before);
    expect(records()).toContain("3 of 10 steps failed");
  });

  it("discards a draft with numbers that are not in the records", async () => {
    generate.mockResolvedValue([{ summary_text: "M014 had 9 failed actions." }]);
    render(<MissionExplanation mission={m} />);
    await draft();
    expect(screen.queryByText("M014 had 9 failed actions.")).toBeNull();
    expect(screen.getByText(/so it was discarded/)).toBeTruthy();
  });
});
