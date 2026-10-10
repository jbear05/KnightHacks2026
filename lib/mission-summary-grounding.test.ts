import { describe, expect, it } from "vitest";
import { summaryReferencesOnlyRecordNumbersAndIds } from "./mission-summary-grounding";

describe("summaryReferencesOnlyRecordNumbersAndIds", () => {
  const source = "Mission M014 had 10 actions, 3 failures, battery 68% to 22%, and HX-217 pressure of 128.8 psi.";

  it("accepts numbers and identifiers present in the source", () => {
    expect(summaryReferencesOnlyRecordNumbersAndIds("M014 had 3 failed actions; HX-217 pressure was 128.8 psi.", source)).toBe(true);
  });

  it("rejects a derived number or unknown record identifier", () => {
    expect(summaryReferencesOnlyRecordNumbersAndIds("The average battery value was 68.8%.", source)).toBe(false);
    expect(summaryReferencesOnlyRecordNumbersAndIds("HX-999 had a problem.", source)).toBe(false);
  });
});