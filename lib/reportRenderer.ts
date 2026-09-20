import type { FitmentInput, FitmentReport, FitmentVisualization, StoredFitmentResult } from "./types";

export const FITMENT_RESULT_STORAGE_KEY = "driveline.latestFitmentResult";
export const TRUCK_PROFILE_STORAGE_KEY = "driveline.truckProfile";

export function createStoredFitmentResult(
  input: FitmentInput,
  report: FitmentReport,
  visualization?: FitmentVisualization
): StoredFitmentResult {
  return {
    input,
    report,
    createdAt: new Date().toISOString(),
    generatedImageUrl: visualization?.generatedImageUrls?.[0] || visualization?.generatedImageUrl || null,
    generatedImageUrls: visualization?.generatedImageUrls?.length
      ? visualization.generatedImageUrls
      : visualization?.generatedImageUrl
        ? [visualization.generatedImageUrl]
        : undefined,
    sourcePhotoUrls: visualization?.sourcePhotoUrls?.length ? visualization.sourcePhotoUrls : undefined,
    alreadyModified: visualization?.alreadyModified ?? false
  };
}

export function firstSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^.+?[.!?](?:\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

export function toShortParagraphs(text: string, limit = 2) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function formatFitmentLabel(value: string) {
  const labels: Record<string, string> = {
    daily: "Daily driver",
    mixed: "Street and trail",
    "off-road": "Trail focused",
    normal: "Normal rear weight",
    "sometimes-heavy": "Occasional load",
    "constant-heavy": "Constant rear weight",
    easy: "Easy",
    acceptable: "Acceptable",
    compromised: "Compromised",
    limited: "Limited",
    balanced: "Balanced",
    strong: "Strong"
  };

  return labels[value] ?? value;
}

export function getFitmentSummaryRows(report: FitmentReport) {
  return [
    { label: "Rubbing risk", value: report.rubbingRisk },
    { label: "Trimming likely", value: report.trimmingLikely ? "Yes" : "No" },
    { label: "Body mount chop likely", value: report.bodyMountChopLikely ? "Yes" : "No" },
    { label: "Suspension stress", value: report.suspensionStress },
    { label: "Daily drivability", value: report.dailyDrivability },
    { label: "Off-road practicality", value: report.offRoadPracticality }
  ];
}

export function saveFitmentResult(input: FitmentInput, report: FitmentReport, visualization?: FitmentVisualization) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FITMENT_RESULT_STORAGE_KEY,
    JSON.stringify(createStoredFitmentResult(input, report, visualization))
  );
}

export function loadFitmentResult(): StoredFitmentResult | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(FITMENT_RESULT_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredFitmentResult;
  } catch {
    return null;
  }
}

export function saveTruckProfile(input: FitmentInput) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRUCK_PROFILE_STORAGE_KEY, JSON.stringify(input));
}

export function loadTruckProfile(): FitmentInput | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TRUCK_PROFILE_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as FitmentInput;
  } catch {
    return null;
  }
}

export function clearTruckProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TRUCK_PROFILE_STORAGE_KEY);
}
