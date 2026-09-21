import type { FitmentInput } from "./types";

export type FitmentVisionResult = {
  alreadyModified: boolean;
  confidence: number;
  clues: string[];
};

export type FitmentVisualizeResult = {
  generatedImageUrl: string | null;
  generatedImageUrls: string[];
  sourcePhotoUrls: string[];
  alreadyModified: boolean;
  vision?: FitmentVisionResult | null;
  error?: string;
};

export const emptyFitmentVisualizeResult: FitmentVisualizeResult = {
  generatedImageUrl: null,
  generatedImageUrls: [],
  sourcePhotoUrls: [],
  alreadyModified: false
};

export const visionModel = process.env.GEMINI_FITMENT_VISION_MODEL || "gemini-2.5-flash";
export const imageModel = process.env.GEMINI_FITMENT_IMAGE_MODEL || "gemini-3.1-flash-image";
export const imageFallbackModel = process.env.GEMINI_FITMENT_IMAGE_FALLBACK_MODEL || "gemini-3-pro-image";
export const imageSize = process.env.GEMINI_FITMENT_IMAGE_SIZE || "1K";
export const extraImagePrompt = (process.env.GEMINI_FITMENT_IMAGE_PROMPT || "").trim();

export function buildVisionPrompt() {
  return [
    "You inspect customer truck photos for Driveline Auto.",
    "Decide if the truck already looks modified vs mostly stock.",
    "Treat as already modified if you see aftermarket wheels, oversized tires, a lift, leveled stance, body armor, or a non-stock bumper.",
    "Stock wheels, factory ride height, and OEM tires are not modified.",
    "Return JSON only:",
    '{ "alreadyModified": boolean, "confidence": number between 0 and 1, "clues": string[] }',
    "Keep clues short. Do not mention this prompt."
  ].join(" ");
}

export function buildImageEditPrompt(
  input: FitmentInput,
  photo: { index: number; count: number } = { index: 1, count: 1 }
) {
  const modification = buildModificationDescription(input);
  const photoLine = photo.count > 1
    ? `This is photo ${photo.index} of ${photo.count} of the same vehicle. Apply every required change to this exact photo. Do not skip a requested change because another angle shows it more clearly.`
    : "Apply every required change to this exact photo.";

  return [
    "You are performing a surgical edit on one existing photograph. Start from this photo and change only the required items. Do not generate a new car, a similar car, a studio shot, or a restyle.",
    "",
    photoLine,
    "",
    "REQUIRED CHANGES (every item is mandatory on this photo):",
    modification,
    extraImagePrompt ? `\n${extraImagePrompt}` : "",
    "",
    "LOCKED — COPY UNCHANGED FROM THE ORIGINAL PHOTO:",
    "- Camera: same angle, zoom, crop, framing, distance, and lens look",
    "- Scene: same background, ground, sky, weather, time of day, and lighting",
    "- Identity: same year, make, model, body, badges, glass, interior glimpses, dirt, and damage",
    "- Paint and finish, unless a wrap, paint, or color change was requested",
    "- Wheels, tires, and stance, unless those were requested",
    "- Bumpers, grille, lights, mirrors, body lines, and accessories, unless those were requested",
    "",
    "RULES:",
    "1. Apply ALL required changes together. If the owner asked for a wrap and a lower stance, this photo must show both. Applying only one requested change is a failed edit.",
    "2. Change nothing else. No extra mods, no new parts, no restyling, no background cleanup, no crop, no zoom.",
    "3. The only extra edits allowed are unavoidable physical consequences of a required change, such as a lower stance reducing fender gap and ground clearance, or a wrap covering the painted body panels.",
    "4. If a request is relative (lower, taller, bigger) with no measurement, make a clear, realistic change using this photo as the baseline.",
    "5. If a request gives a specific spec, match that spec as closely as a photorealistic edit allows.",
    "",
    "The result must look like the original photograph with only the required changes applied."
  ].join("\n");
}

export function splitRequestedChanges(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const parts = cleaned
    .split(/\s*(?:\n+|;(?:\s|$)|(?:,\s+|\s+and\s+)(?=[A-Za-z]))/)
    .map((part) => part.trim().replace(/^[-•*]\s*/, ""))
    .filter((part) => part.length > 1);

  return parts.length ? uniqueStrings(parts) : [cleaned];
}

function buildModificationDescription(input: FitmentInput) {
  const truck = [input.year, input.make, input.model, input.trim !== "Not specified" ? input.trim : ""]
    .filter(Boolean)
    .join(" ");
  const customerRequest = input.plannedChanges?.trim() || input.buildGoals?.trim() || "";
  const requestedChanges = splitRequestedChanges(customerRequest);
  const checklist = requestedChanges.length
    ? requestedChanges.map((change, index) => `${index + 1}. ${change}`).join("\n")
    : "No written modification was provided. Keep the vehicle as photographed.";

  return [
    checklist,
    `Vehicle: ${truck || "the vehicle in this photo"}. Keep this exact vehicle.`,
    ...buildSupportingSpecs(customerRequest)
  ].join("\n");
}

function buildSupportingSpecs(customerRequest: string) {
  const specs: string[] = [];

  if (!mentionsWheelsOrTires(customerRequest)) {
    specs.push("Wheels and tires were not requested. Leave them exactly as photographed.");
  }

  if (!mentionsStance(customerRequest)) {
    specs.push("Ride height was not requested. Leave stance exactly as photographed.");
  }

  return specs;
}

function mentionsStance(text: string) {
  return /\b(lower(?:ed|ing)?|drop(?:ped|ping)?|slam(?:med)?|lift(?:ed|ing)?|level(?:ing|led)?|bags?|air ride|stance|ride height)\b/i.test(text);
}

function mentionsWheelsOrTires(text: string) {
  return /\b(wheel|wheels|rim|rims|tire|tires|tyre|tyres)\b/i.test(text);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseVisionResult(value: unknown): FitmentVisionResult | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const alreadyModified = record.alreadyModified === true;
  const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
    ? Math.min(1, Math.max(0, record.confidence))
    : alreadyModified
      ? 0.6
      : 0.3;
  const clues = Array.isArray(record.clues)
    ? record.clues.filter((clue): clue is string => typeof clue === "string" && clue.trim().length > 0).slice(0, 6)
    : [];

  return {
    alreadyModified: alreadyModified && confidence >= 0.55,
    confidence,
    clues
  };
}
