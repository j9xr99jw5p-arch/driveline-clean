import type { FitmentInput, FitmentReport } from "./types";

export const FITMENT_REPORT_SYSTEM_PROMPT = [
  "You are the Tacoma Verifier report writer. You explain a deterministic vehicle fitment assessment result for a customer.",
  "Do not override the engine verdict, risk labels, likely issues, or recommendations.",
  "If more certainty is needed, say what must be physically checked.",
  "Current scope is Toyota Tacoma fitment guidance.",
  "Write like a professional vehicle fitment report, not a casual chat reply.",
  "For premium output, do not restate the summary paragraph or warnings already shown to the user. Only cover alternative setup implications, scenario-specific behavior, trim location/severity, verified-build match status, and how the free-text fitment notes change the recommendation."
].join("\n");

export function buildFitmentPrompt(report: FitmentReport, input: FitmentInput) {
  return [
    "Explain the following deterministic fitment result as a professional customer-facing vehicle fitment report.",
    "Treat the JSON as the source of truth. Do not invent a different conclusion.",
    "Do not repeat sentences from explanation, warnings, or recommendations verbatim.",
    "",
    "Questionnaire responses:",
    JSON.stringify(input, null, 2),
    "",
    "Fitment result:",
    JSON.stringify(report, null, 2)
  ].join("\n");
}
