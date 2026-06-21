import { formatBoolean, formatBuildTitle, formatSuspension, formatWheelTireCombo } from "@/lib/buildDisplay";
import type { VerifiedBuild } from "@/lib/types";

export function getReviewedBuildSummary(build: VerifiedBuild) {
  return build.build_summary?.trim() || createLocalBuildSummary(build);
}

export function createLocalBuildSummary(build: VerifiedBuild) {
  const title = formatBuildTitle(build);
  const wheelTire = formatWheelTireCombo(build);
  const suspension = formatSuspension(build);
  const lift = build.lift_height !== null && build.lift_height !== undefined ? `${build.lift_height}-inch lift` : null;
  const rubbing = build.rubbing_severity ? `${build.rubbing_severity.toLowerCase()} rubbing` : "unknown rubbing";
  const trimming = formatBoolean(build.trimming_required).toLowerCase();
  const bodyMountChop = formatBoolean(build.body_mount_chop).toLowerCase();
  const risk = build.fitment_risk ? `${build.fitment_risk} risk` : "unknown risk";
  const clearanceWork = [
    build.trimming_required !== null ? `trimming: ${trimming}` : null,
    build.body_mount_chop !== null ? `body mount chop: ${bodyMountChop}` : null
  ].filter(Boolean).join(", ");
  const extraMods = [
    build.lighting_upgrades ? `Lighting upgrades include ${build.lighting_upgrades}.` : null,
    build.favorite_modifications ? `Favorite recommended modifications include ${build.favorite_modifications}.` : null
  ].filter(Boolean).join(" ");

  return `${title} is running ${wheelTire}${lift ? ` with a ${lift}` : ""}${suspension && suspension !== "Unknown" ? ` and ${suspension}` : ""}. The owner reported ${rubbing}, and this setup is currently classified as ${risk}. ${clearanceWork ? `For clearance, the reported work is ${clearanceWork}. ` : ""}${extraMods ? `${extraMods} ` : ""}This is a useful real-world reference for comparing tire size, wheel offset, lift height, and the amount of trimming or body mount clearance needed before copying the setup.`;
}

export function buildSummaryPrompt(build: VerifiedBuild) {
  return `Write a concise but useful Tacoma build explanation in a confident fitment-review style.

Use plain language. Mention the vehicle, tire size, wheel size/offset, lift/suspension, rubbing, trimming, and body mount chop only if that data exists. Do not exaggerate. Do not invent missing details. Use yes/no style language when relevant instead of true/false. Keep it around 120-180 words.

Raw build:
${JSON.stringify({
    vehicle: formatBuildTitle(build),
    year: build.year,
    make: build.make,
    model: build.model,
    trim: build.trim,
    cab: build.cab,
    bed: build.bed,
    tire_size: build.tire_size,
    tire_brand: build.tire_brand,
    tire_model: build.tire_model,
    wheel_size: build.wheel_size,
    wheel_brand: build.wheel_brand,
    wheel_model: build.wheel_model,
    wheel_offset: build.wheel_offset,
    lift_height: build.lift_height,
    suspension_setup: build.suspension_setup,
    suspension_brand: build.suspension_brand,
    suspension_model: build.suspension_model,
    suspension_type: build.suspension_type,
    lighting_upgrades: build.lighting_upgrades,
    favorite_modifications: build.favorite_modifications,
    rubbing_severity: build.rubbing_severity,
    trimming_required: formatBoolean(build.trimming_required),
    body_mount_chop: formatBoolean(build.body_mount_chop),
    fitment_risk: build.fitment_risk,
    notes: build.notes
  }, null, 2)}`;
}
