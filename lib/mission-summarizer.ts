import { buildMissionRecordSummary, buildMissionSummaryInput } from "./mission-summary-input";
import { summaryReferencesOnlyRecordNumbersAndIds } from "./mission-summary-grounding";
import type { MissionDetail } from "./types";

const MODEL_ID = "Falconsai/text_summarization";

// One shared import: the library is large, and both the cache check and the pipeline need it.
let libraryPromise: Promise<typeof import("@huggingface/transformers")> | undefined;
const library = () =>
  (libraryPromise ??= import("@huggingface/transformers").catch((error) => {
    libraryPromise = undefined;
    throw error;
  }));

async function loadSummarizer() {
  const { pipeline } = await library();
  return pipeline("summarization", MODEL_ID, { dtype: "fp32" });
}

let summarizerPromise: ReturnType<typeof loadSummarizer> | undefined;

/** True when the model files are already in this browser's cache, so a draft costs no download. */
export async function isSummarizerCached(): Promise<boolean> {
  try {
    const { ModelRegistry } = await library();
    return await ModelRegistry.is_pipeline_cached("summarization", MODEL_ID, { dtype: "fp32" });
  } catch {
    return false;
  }
}

const RECORD_ID = /\b[a-z]+-?\d+\b/gi;
const SENTENCE_END = /[.!?](?=\s|$)/g;

/**
 * Small T5 output is lower-cased and often stops mid-sentence. Restore record IDs to their recorded
 * spelling, capitalise sentences, and drop a cut-off tail. Words are never added.
 */
export function tidyDraft(text: string, input: string): string {
  const ids = new Map((input.match(RECORD_ID) ?? []).map((id) => [id.toUpperCase(), id]));
  let out = text.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  out = out.replace(RECORD_ID, (id) => ids.get(id.toUpperCase()) ?? id);
  const ends = [...out.matchAll(SENTENCE_END)];
  const last = ends.at(-1);
  if (!last) out += ".";
  else if (last.index + 1 < out.length) out = out.slice(0, last.index + 1);
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, first: string) => lead + first.toUpperCase());
}

export interface MissionSummaryResult {
  text: string;
  source: "model" | "records";
}

export async function summarizeMission(mission: MissionDetail): Promise<MissionSummaryResult> {
  summarizerPromise ??= loadSummarizer();

  try {
    const summarizer = await summarizerPromise;
    const input = buildMissionSummaryInput(mission);
    const [result] = await summarizer(input, {
      max_length: 110,
      min_length: 30,
      do_sample: false,
      num_beams: 4,
      no_repeat_ngram_size: 3,
    });
    const raw = result?.summary_text?.trim();
    const summary = raw ? tidyDraft(raw, input) : "";
    if (!summary) throw new Error("The model returned an empty summary.");
    if (summaryReferencesOnlyRecordNumbersAndIds(summary, input)) return { text: summary, source: "model" };
    return { text: buildMissionRecordSummary(mission), source: "records" };
  } catch (error) {
    summarizerPromise = undefined;
    throw error;
  }
}