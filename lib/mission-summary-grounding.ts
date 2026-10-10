const RECORD_ID = /\b[A-Z]{1,8}(?:-\d{2,}|\d{2,})\b/g;
const NUMBER = /\b\d+(?:\.\d+)?\b/g;

function numberClaims(text: string): string[] {
  return (text.replace(RECORD_ID, "").match(NUMBER) ?? []).map((value) => Number(value).toString());
}

function recordIds(text: string): Set<string> {
  return new Set(text.match(RECORD_ID) ?? []);
}

export function summaryReferencesOnlyRecordNumbersAndIds(summary: string, source: string): boolean {
  const sourceNumbers = new Set(numberClaims(source));
  const sourceIds = recordIds(source);
  const usesKnownNumbers = numberClaims(summary).every((value) => sourceNumbers.has(value));
  const usesKnownIds = [...recordIds(summary)].every((value) => sourceIds.has(value));
  return usesKnownNumbers && usesKnownIds;
}