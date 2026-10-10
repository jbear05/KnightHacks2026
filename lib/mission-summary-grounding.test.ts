import { describe, expect, it } from "vitest";
import { summaryReferencesOnlyRecordNumbersAndIds } from "./mission-summary-grounding";

describe("summaryReferencesOnlyRecordNumbersAndIds", () => {
  const source = "Mission M014 used V1 and had 10 actions, 3 failures, battery 68% to 22%, and HX-217 pressure of 128.8 psi.";

  it("accepts numbers and identifiers present in the source", () => {
    expect(summaryReferencesOnlyRecordNumbersAndIds("M014 had 3 failed actions; HX-217 pressure was 128.8 psi.", source)).toBe(true);
  });

  it("rejects a derived number or unknown record identifier", () => {
    expect(summaryReferencesOnlyRecordNumbersAndIds("The average battery value was 68.8%.", source)).toBe(false);
    expect(summaryReferencesOnlyRecordNumbersAndIds("HX-999 had a problem.", source)).toBe(false);
  });

  it.each([
    "M014 had nine failed actions.",
    "Mission m999 completed.",
    "M014 used configuration V2.",
    "End battery was -22%.",
    "End battery was −22%.",
    "End battery was –22%.",
    "End battery was - 22%.",
    "End battery was negative 22%.",
    "End battery was sixty-eight percent.",
    "Pressure was one hundred twenty-eight point eight psi.",
    "There were a dozen failures.",
    "There were twice as many failures.",
    "End battery was 68,000%.",
    "End battery was .22%.",
    "End battery was 22e3%.",
    "Battery was 3/10 of capacity.",
    "Battery was ½ of capacity.",
    "End battery was ２２%.",
  ])("rejects unsupported or ambiguous numeric claims: %s", (summary) => {
    expect(summaryReferencesOnlyRecordNumbersAndIds(summary, source)).toBe(false);
  });

  it("accepts known IDs regardless of casing and preserves their numeric suffixes", () => {
    expect(summaryReferencesOnlyRecordNumbersAndIds("m014 used v1; hx-217 pressure was 128.80 psi.", source)).toBe(true);
    expect(summaryReferencesOnlyRecordNumbersAndIds("M14 completed.", source)).toBe(false);
    expect(summaryReferencesOnlyRecordNumbersAndIds("There were 217 failures.", source)).toBe(false);
  });

  it("keeps genuinely negative source values distinct from positive values", () => {
    const signedSource = "HX-217 measured -22 C.";
    expect(summaryReferencesOnlyRecordNumbersAndIds("hx-217 measured −22.0 C.", signedSource)).toBe(true);
    expect(summaryReferencesOnlyRecordNumbersAndIds("HX-217 measured 22 C.", signedSource)).toBe(false);
  });

  it("accepts equivalent digit notation without splitting a larger value", () => {
    expect(summaryReferencesOnlyRecordNumbersAndIds("Pressure was 1,280.0 psi.", "Pressure was 1280 psi.")).toBe(true);
    expect(summaryReferencesOnlyRecordNumbersAndIds("Battery was +22%.", source)).toBe(true);
  });
});
