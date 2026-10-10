import { buildMissionRecordSummary, buildMissionSummaryInput } from "./mission-summary-input";
import { summaryReferencesOnlyRecordNumbersAndIds } from "./mission-summary-grounding";
import type { MissionDetail } from "./types";

const MODEL_ID = "Falconsai/text_summarization";

async function loadSummarizer() {
  const { pipeline } = await import("@huggingface/transformers");
  return pipeline("summarization", MODEL_ID, { dtype: "fp32" });
}

let summarizerPromise: ReturnType<typeof loadSummarizer> | undefined;

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
    const summary = result?.summary_text?.trim();
    if (!summary) throw new Error("The model returned an empty summary.");
    if (summaryReferencesOnlyRecordNumbersAndIds(summary, input)) return { text: summary, source: "model" };
    return { text: buildMissionRecordSummary(mission), source: "records" };
  } catch (error) {
    summarizerPromise = undefined;
    throw error;
  }
}