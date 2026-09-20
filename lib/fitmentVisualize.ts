import type { FitmentInput } from "./types";

export type FitmentVisionResult = {
  alreadyModified: boolean;
  confidence: number;
  clues: string[];
};

export type FitmentVisualizeResult = {
  generatedImageUrl: string | null;
  sourcePhotoUrls: string[];
  alreadyModified: boolean;
  vision?: FitmentVisionResult | null;
  error?: string;
};

export const emptyFitmentVisualizeResult: FitmentVisualizeResult = {
  generatedImageUrl: null,
  sourcePhotoUrls: [],
  alreadyModified: false
};

export const visionModel = process.env.GEMINI_FITMENT_VISION_MODEL || "gemini-2.5-flash";
export const imageModel = process.env.GEMINI_FITMENT_IMAGE_MODEL || "gemini-3.1-flash-image";
export const imageFallbackModel = process.env.GEMINI_FITMENT_IMAGE_FALLBACK_MODEL || "gemini-3-pro-image";
export const imageSize = process.env.GEMINI_FITMENT_IMAGE_SIZE || "1K";

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

export function buildImageEditPrompt(input: FitmentInput, referenceCount: number) {
  const truck = [input.year, input.make, input.model, input.trim !== "Not specified" ? input.trim : ""]
    .filter(Boolean)
    .join(" ");
  const wheel = `${input.wheelDiameter}x${input.wheelWidth} wheels at ${input.wheelOffset}mm offset`;
  const lift = input.liftHeight > 0 ? `${input.liftHeight} inch lift` : "stock ride height";
  const use = input.useCase === "off-road" ? "trail-ready stance" : input.useCase === "daily" ? "clean street stance" : "street-and-trail stance";
  const refs = referenceCount
    ? `Use the last ${referenceCount} image${referenceCount === 1 ? "" : "s"} only as a stance, tire, and wheel-fit reference. Do not copy that truck’s color, body damage, or background.`
    : "";

  return [
    `Edit the customer’s actual ${truck} photos. Keep the same truck identity: body lines, paint color, cab, bed, angle, lighting, and background.`,
    `Show this setup installed: ${input.tireSize} tires on ${wheel}, ${lift}, ${use}.`,
    "Make the tires and wheels fill the fenders realistically. Do not invent extra accessories.",
    "Photorealistic outdoor truck photo, not CGI, not a rendering, no text, no watermark, no logo.",
    refs
  ]
    .filter(Boolean)
    .join(" ");
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
