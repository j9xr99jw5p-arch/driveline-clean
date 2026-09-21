import { formatBoolean, formatBuildTitle, formatSuspension } from "@/lib/buildDisplay";
import type { VerifiedBuild } from "@/lib/types";

export function getReviewedBuildSummary(build: VerifiedBuild) {
  const reviewedSummary = build.build_summary?.trim();
  if (
    reviewedSummary &&
    !looksLikeLegacyBuildSummary(reviewedSummary) &&
    !looksLikePartsCatalogSummary(reviewedSummary)
  ) {
    return stripPartsCatalogFromSummary(reviewedSummary);
  }

  return createLocalBuildSummary(build);
}

export function createLocalBuildSummary(build: VerifiedBuild) {
  const title = formatBuildTitle(build);
  const wheelTire = formatNaturalWheelTireCombo(build);
  const suspension = formatSuspension(build);
  const lift = build.lift_height !== null && build.lift_height !== undefined ? `${build.lift_height}-inch lift` : null;
  const setupParts = [
    wheelTire,
    lift ? `${lift}` : null,
    suspension && suspension !== "Unknown" && suspension !== "Suspension setup not listed" ? suspension : null
  ].filter((part): part is string => Boolean(part));
  const opening = createOpeningSentence(title, setupParts);
  const fitmentResult = createFitmentResultSentence(build);
  const copyAdvice = createCopyAdviceSentence(build);

  return [opening, fitmentResult, copyAdvice].filter(Boolean).join(" ");
}

export function buildSummaryPrompt(build: VerifiedBuild) {
  return `Write a concise fitment summary for this truck in a confident review style.

Cover the vehicle, tire/wheel/lift setup, and the real-world fitment result (rubbing, trimming, body mount chop) only if that data exists. Do not list lighting, interior, armor, recovery, or extra mods. Keep it around 70-110 words. Do not invent missing details. Do not mention Tacoma unless this truck is a Toyota Tacoma.

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
    rubbing_severity: build.rubbing_severity,
    trimming_required: formatBoolean(build.trimming_required),
    body_mount_chop: formatBoolean(build.body_mount_chop),
    fitment_risk: build.fitment_risk,
    notes: build.notes
  }, null, 2)}`;
}

function looksLikePartsCatalogSummary(summary: string) {
  const lower = summary.toLowerCase();
  return (
    lower.includes("lighting upgrades include") ||
    lower.includes("as worthwhile mods") ||
    lower.includes("favorite modifications") ||
    summary.length > 900
  );
}

function looksLikeLegacyBuildSummary(summary: string) {
  const lower = summary.toLowerCase();
  return [
    " is running ",
    "trimming:",
    "body mount chop:",
    "classified as",
    "reported work is"
  ].some((phrase) => lower.includes(phrase));
}

function stripPartsCatalogFromSummary(summary: string) {
  return summary
    .replace(/\s*Lighting upgrades include[\s\S]*?(?=\s+The owner also called out|\s+If you are copying|$)/i, "")
    .replace(/\s*The owner also called out[\s\S]*?as worthwhile mods\./gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatNaturalWheelTireCombo(build: VerifiedBuild) {
  const tire = [
    build.tire_brand,
    build.tire_model,
    build.tire_size ? `${build.tire_size} tires` : null
  ].filter(Boolean).join(" ");
  const wheel = [
    build.wheel_brand,
    build.wheel_model,
    build.wheel_size ? `${build.wheel_size} wheels` : null,
    build.wheel_offset != null ? `${build.wheel_offset}mm offset` : null
  ].filter(Boolean).join(" ");

  if (tire && wheel) return `${tire} on ${wheel}`;
  if (tire) return tire;
  if (wheel) return wheel;
  return "a wheel and tire setup that needs more detail";
}

function createOpeningSentence(title: string, setupParts: string[]) {
  const setup = setupParts.join(", ");
  if (!setup) return `${title} has a fitment setup worth comparing against before you commit to a build.`;

  const variant = title.length % 3;
  if (variant === 0) return `${title} pairs ${setup}.`;
  if (variant === 1) return `On this ${title}, the setup centers on ${setup}.`;
  return `${title} uses ${setup}, giving it a practical reference point for similar builds.`;
}

function createFitmentResultSentence(build: VerifiedBuild) {
  const rubbing = formatRubbingSummaryPhrase(build.rubbing_severity);
  const risk = build.fitment_risk ? `${build.fitment_risk} fitment risk` : "an unknown fitment risk";
  const reason = describeRiskReason(build);

  if (build.fitment_risk === "low") {
    return `${rubbing}, and the setup lands in the ${risk} range because ${reason}.`;
  }

  if (build.fitment_risk === "medium") {
    return `In real-world use, ${rubbing.toLowerCase()}; that puts this in the ${risk} range because ${reason}.`;
  }

  return `The fitment story here is more demanding: ${rubbing.toLowerCase()}, with ${risk} because ${reason}.`;
}

function describeRiskReason(build: VerifiedBuild) {
  const rubbing = normalizeRubbingValue(build.rubbing_severity);

  if (build.trimming_required && build.body_mount_chop) {
    return "it needed both trimming and cab-mount clearance work to behave correctly";
  }

  if (build.trimming_required) {
    return "some trimming was needed to keep the tires from catching";
  }

  if (build.body_mount_chop) {
    return "cab-mount clearance became part of making the setup work";
  }

  if (rubbing && rubbing !== "none" && rubbing !== "no") {
    return "there is still some rubbing to account for even without major clearance notes";
  }

  return "the owner did not report major clearance work or serious rubbing";
}

function normalizeRubbingValue(value: string | null | undefined) {
  return value?.toLowerCase().trim() || null;
}

function formatRubbingSummaryPhrase(value: string | null | undefined) {
  const normalized = normalizeRubbingValue(value);

  if (!normalized) return "The owner did not leave a rubbing note";
  if (normalized === "none" || normalized === "no") return "The owner reported no rubbing";
  if (normalized === "minor") return "The owner reported minor rubbing";
  if (normalized === "moderate") return "The owner reported moderate rubbing";
  if (normalized === "severe") return "The owner reported severe rubbing";

  return `The owner described the rubbing as ${value?.trim()}`;
}

function createCopyAdviceSentence(build: VerifiedBuild) {
  const advice: string[] = [];

  if (build.trimming_required) {
    advice.push("plan for liner, mud-flap, or small plastic trimming");
  } else if (build.trimming_required === false) {
    advice.push("you may be able to avoid trimming if your alignment and tire choice are similar");
  }

  if (build.body_mount_chop) {
    advice.push("check the cab mount closely before assuming it will clear");
  } else if (build.body_mount_chop === false) {
    advice.push("a body mount chop should not be the first thing you budget for");
  }

  if (build.fitment_risk === "high") {
    advice.push("expect alignment and clearance details to matter a lot");
  } else if (build.fitment_risk === "medium") {
    advice.push("expect a workable setup, but leave room for small adjustments");
  } else {
    advice.push("use it as a reasonable baseline, then confirm clearance on your own truck");
  }

  return `If you are copying this setup, ${joinAdvice(advice)}.`;
}

function joinAdvice(items: string[]) {
  if (items.length <= 1) return items[0] ?? "confirm the exact wheel, tire, lift, and alignment details first";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
