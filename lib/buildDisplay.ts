import type { VerifiedBuild } from "@/lib/types";

export function cleanJoin(parts: Array<string | number | null | undefined>, separator = " ") {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map(String)
    .join(separator);
}

export function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

export function formatBuildTitle(build: Pick<VerifiedBuild, "year" | "make" | "model" | "trim">) {
  return cleanJoin([build.year, build.make, build.model, build.trim]);
}

export function formatWheelTireCombo(build: VerifiedBuild) {
  const wheel = cleanJoin([
    build.wheel_brand,
    build.wheel_model,
    build.wheel_size,
    build.wheel_offset != null ? `${build.wheel_offset}mm offset` : null
  ]);

  const tire = cleanJoin([
    build.tire_brand,
    build.tire_model,
    build.tire_size
  ]);

  if (wheel && tire) return `${wheel} with ${tire}`;
  if (wheel) return wheel;
  if (tire) return tire;
  return "Wheel/tire setup not listed";
}

export function formatSuspension(build: VerifiedBuild) {
  const structured = cleanJoin([
    build.suspension_brand,
    build.suspension_model,
    build.lift_height != null ? `${build.lift_height} in` : null,
    build.suspension_type
  ]);

  return structured || build.suspension_setup || "Suspension setup not listed";
}

export function formatRisk(value: string | null | undefined) {
  if (!value) return "Unknown risk";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} risk`;
}

export function formatPrimaryFitmentDetails(build: VerifiedBuild) {
  return cleanJoin([
    build.rubbing_severity,
    `Trimming: ${formatBoolean(build.trimming_required)}`,
    `Body mount chop: ${formatBoolean(build.body_mount_chop)}`
  ], " • ");
}

export function formatSecondaryFitmentDetails(build: VerifiedBuild) {
  return cleanJoin([
    cleanJoin([build.cab, build.bed], " / "),
    formatRisk(build.fitment_risk)
  ], " • ");
}
