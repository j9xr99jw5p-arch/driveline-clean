import type { FitmentInput, FitmentReport, StoredFitmentResult } from "./types";

export const FITMENT_RESULT_STORAGE_KEY = "driveline.latestFitmentResult";
export const TRUCK_PROFILE_STORAGE_KEY = "driveline.truckProfile";

export function createStoredFitmentResult(input: FitmentInput, report: FitmentReport): StoredFitmentResult {
  return {
    input,
    report,
    createdAt: new Date().toISOString()
  };
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

export function saveFitmentResult(input: FitmentInput, report: FitmentReport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FITMENT_RESULT_STORAGE_KEY, JSON.stringify(createStoredFitmentResult(input, report)));
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
