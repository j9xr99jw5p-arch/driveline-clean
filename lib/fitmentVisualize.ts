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

export function buildImageEditPrompt(input: FitmentInput, _referenceCount = 0) {
  const modification = buildModificationDescription(input);

  return [
    "You are editing a single existing photograph of a truck. Your only task is to apply the modification described below to that exact photo. Treat this as a precise, surgical edit — not a new render, not a similar truck, not an artistic reinterpretation.",
    "",
    "MODIFICATION TO APPLY:",
    modification,
    extraImagePrompt ? `\n${extraImagePrompt}` : "",
    "",
    "RULES:",
    "1. Change only what is explicitly requested above, plus any change that is a direct, unavoidable physical consequence of it (e.g. a taller lift raises the stance and increases the gap between tire and fender; larger tires fill more of the wheel well and may extend slightly past the fender lip; lowering the truck reduces ground clearance). Do not add any change beyond what the request requires or implies.",
    "2. Do not alter: paint color and finish, wheel design and color (unless wheels/rims are the requested change), rim offset and width (unless requested), badges, decals, grille, headlights/taillights, mirrors, bumpers, bed style, cab configuration, window tint, or any existing wear or damage visible in the original photo.",
    "3. Do not alter the camera: same angle, height, distance from the truck, field of view, framing, and crop as the original.",
    "4. Do not alter the environment: same background, ground surface, weather, time of day, lighting direction, color temperature, and shadow placement as the original, except where the modification itself physically changes a shadow.",
    "5. Match the original photo's style: same resolution, sharpness, grain, and level of realism. This must read as the same photograph, edited — not a new image generated to resemble it.",
    "6. If the request is relative (bigger, smaller, taller, lower, more aggressive, etc.) with no exact measurement, apply a visually clear, realistic change sized appropriately for this vehicle, using the tires, wheels, and stance already visible in the photo as the baseline for comparison.",
    "7. If the request gives a specific spec (e.g. \"35-inch tires,\" \"6-inch lift,\" \"2-inch leveling kit,\" \"20-inch wheels\"), match that spec as closely as a photorealistic edit allows.",
    "8. Respect this specific vehicle's real proportions as shown in the photo (cab style, bed length, fender shape) — the result must still read as the same make and model, not a generic or different truck.",
    "9. If more than one photo of the same truck is provided, apply the identical modification consistently across all of them.",
    "",
    "The result must be immediately recognizable as the same truck, in the same photo, with only the described modification changed."
  ].join("\n");
}

function buildModificationDescription(input: FitmentInput) {
  const truck = [input.year, input.make, input.model, input.trim !== "Not specified" ? input.trim : ""]
    .filter(Boolean)
    .join(" ");
  const wheel = `${input.wheelDiameter}x${input.wheelWidth} wheels at ${input.wheelOffset}mm offset`;
  const lift = input.liftHeight > 0 ? `${input.liftHeight} inch lift` : "stock ride height";
  const customerRequest = input.plannedChanges?.trim() || input.buildGoals?.trim() || "";

  return [
    customerRequest,
    `Vehicle: ${truck}.`,
    `Exact setup to match: ${input.tireSize} tires on ${wheel}, ${lift}.`
  ]
    .filter(Boolean)
    .join("\n");
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
