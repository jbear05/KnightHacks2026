// Include configuration IDs (V1/V2), and compare casing without changing suffixes.
const RECORD_ID = /\b[a-z]+-?\d+\b/gi;
const NUMBER = /(?:[+-]\s*)?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi;
// Source facts use digits. Fail closed on prose numbers rather than trying to
// interpret compounds, fractions, ordinals, or words that can change a sign.
const NUMBER_WORD = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|dozen|half|halves|quarter|quarters|once|twice|single|double|triple|negative|minus|positive|plus)\b/i;
const FRACTION = /\d\s*[/⁄÷]\s*\d/;

function normalize(text: string): string {
  return text.replace(/[−‐‑‒–—﹣－]/g, "-").replace(/＋/g, "+");
}

function numberClaims(text: string): string[] {
  // ID suffixes are not standalone numeric evidence (HX-217 does not allow 217).
  return (text.replace(RECORD_ID, "").match(NUMBER) ?? [])
    .map((value) => Number(value.replace(/[\s,]/g, "")).toString());
}

function recordIds(text: string): Set<string> {
  return new Set((text.match(RECORD_ID) ?? []).map((id) => id.toUpperCase()));
}

export function summaryReferencesOnlyRecordNumbersAndIds(summary: string, source: string): boolean {
  if (NUMBER_WORD.test(summary) || FRACTION.test(summary) || /\p{N}/u.test(summary.replace(/\d/g, ""))) return false;
  summary = normalize(summary);
  source = normalize(source);
  const sourceNumbers = new Set(numberClaims(source));
  const sourceIds = recordIds(source);
  const usesKnownNumbers = numberClaims(summary).every((value) => sourceNumbers.has(value));
  const usesKnownIds = [...recordIds(summary)].every((value) => sourceIds.has(value));
  return usesKnownNumbers && usesKnownIds;
}
