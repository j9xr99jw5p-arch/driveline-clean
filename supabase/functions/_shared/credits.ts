// Keep this file in sync with supabase/functions/_shared/credits.ts and src/lib/credits.ts until this becomes a shared package.

export const CREDITS_BASE = 1;
export const CREDITS_PER_PHOTO = 1;
export const CREDITS_WRAP_OR_PAINT = 2;
export const CREDITS_STANCE_CHANGE = 1;
export const CREDITS_WHEEL_OR_TIRE_CHANGE = 1;
export const CREDITS_PER_EXTRA_MOD = 1;

/** Hard cap on photos billed and rendered for one mod request. */
export const MAX_PHOTOS = 3;

export const WRAP_OR_PAINT_TAGS = ["wrap", "paint", "color", "wrap_or_paint"] as const;
export const STANCE_TAGS = ["stance", "lower", "lift", "level", "bags", "air_ride", "ride_height"] as const;
export const WHEEL_OR_TIRE_TAGS = ["wheel", "wheels", "tire", "tires", "rim", "rims"] as const;

export type ModComplexityInput = {
  photoCount: number;
  modTags: string[];
  wrapOrPaint?: boolean;
  stanceChange?: boolean;
  wheelOrTireChange?: boolean;
  extraModCount?: number;
};

export function calculateCredits(input: ModComplexityInput): number {
  const photoCount = clampPhotoCount(input.photoCount);
  const complexity = complexityFromTags(input);

  return (
    CREDITS_BASE +
    photoCount * CREDITS_PER_PHOTO +
    (complexity.wrapOrPaint ? CREDITS_WRAP_OR_PAINT : 0) +
    (complexity.stanceChange ? CREDITS_STANCE_CHANGE : 0) +
    (complexity.wheelOrTireChange ? CREDITS_WHEEL_OR_TIRE_CHANGE : 0) +
    complexity.extraModCount * CREDITS_PER_EXTRA_MOD
  );
}

export function normalizeModTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean);

  return [...new Set(tags)];
}

function complexityFromTags(input: ModComplexityInput) {
  const tags = normalizeModTags(input.modTags);
  const knownTags = new Set<string>([
    ...WRAP_OR_PAINT_TAGS,
    ...STANCE_TAGS,
    ...WHEEL_OR_TIRE_TAGS
  ]);

  return {
    wrapOrPaint: input.wrapOrPaint ?? tags.some((tag) => (WRAP_OR_PAINT_TAGS as readonly string[]).includes(tag)),
    stanceChange: input.stanceChange ?? tags.some((tag) => (STANCE_TAGS as readonly string[]).includes(tag)),
    wheelOrTireChange:
      input.wheelOrTireChange ?? tags.some((tag) => (WHEEL_OR_TIRE_TAGS as readonly string[]).includes(tag)),
    extraModCount: Math.max(
      0,
      Math.floor(input.extraModCount ?? tags.filter((tag) => !knownTags.has(tag)).length)
    )
  };
}

function clampPhotoCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_PHOTOS, Math.floor(value));
}
