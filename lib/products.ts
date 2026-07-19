export type ProductVariantOption = {
  id: string;
  variantName: string;
  lightPattern: string | null;
  beamPattern: string | null;
  lensColor: string | null;
  harnessIncluded: boolean;
  dielectricGreaseIncluded: boolean | null;
  protectiveFilmIncluded: boolean | null;
  size: string | null;
  finish: string | null;
  sku: string | null;
  supplierSku: string | null;
  stripePriceId: string | null;
  imageUrl: string | null;
  active: boolean;
  inventoryStatus: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  priceSource?: "stripe" | "database" | "unavailable";
};

export type ReviewSentiment = "very_positive" | "mostly_positive" | "mixed" | "mostly_negative" | "very_negative";

export type ReviewRatingBreakdown = Partial<Record<"5" | "4" | "3" | "2" | "1", number>>;

export type ProductReviewFields = {
  reviewSentiment: string | null;
  reviewSummary: string | null;
  reviewPraise: unknown;
  reviewComplaints: unknown;
  reviewTakeaway: string | null;
  reviewCountAnalyzed: number | null;
  reviewRatingAverage: number | null;
  reviewRatingBreakdown: unknown;
  reviewSourceName: string | null;
  reviewSourceUrl: string | null;
};

export type ProductReviewSummary = {
  sentiment: ReviewSentiment | null;
  sentimentLabel: string | null;
  summary: string | null;
  praise: string[];
  complaints: string[];
  takeaway: string | null;
  countAnalyzed: number | null;
  ratingAverage: number | null;
  ratingBreakdown: ReviewRatingBreakdown;
  sourceName: string | null;
  sourceUrl: string | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  priceCents: number | null;
  priceLabel: string | null;
  stripePriceId: string | null;
  buildCount: number;
  variants: ProductVariantOption[];
  priceSource?: "stripe" | "database" | "unavailable";
} & ProductReviewFields;

export const reviewSentimentLabels: Record<ReviewSentiment, string> = {
  very_positive: "Very positive",
  mostly_positive: "Mostly positive",
  mixed: "Mixed",
  mostly_negative: "Mostly negative",
  very_negative: "Very negative"
};

const placeholderVariantNames = new Set([
  "default",
  "standard",
  "single option",
  "one option",
  "base",
  "regular"
]);

export function formatCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export function getVariantAddOnPriceCents(variant: Pick<ProductVariantOption, "dielectricGreaseIncluded">) {
  return variant.dielectricGreaseIncluded ? 450 : 0;
}

export function applyVariantAddOnPricing<T extends ProductVariantOption>(variant: T): T {
  const addOnPriceCents = getVariantAddOnPriceCents(variant);
  if (!addOnPriceCents || typeof variant.priceCents !== "number") return variant;

  const priceCents = variant.priceCents + addOnPriceCents;
  return {
    ...variant,
    priceCents,
    priceLabel: formatCents(priceCents)
  };
}

export function mapVariant(row: ProductVariantRow): ProductVariantOption {
  return {
    id: row.id,
    variantName: row.variant_name,
    lightPattern: row.light_pattern ?? row.beam_pattern ?? null,
    beamPattern: row.beam_pattern ?? null,
    lensColor: row.lens_color ?? null,
    harnessIncluded: Boolean(row.harness_included),
    dielectricGreaseIncluded: row.dielectric_grease_included ?? null,
    protectiveFilmIncluded: row.protective_film_included ?? null,
    size: row.size ?? null,
    finish: row.finish ?? null,
    sku: row.sku ?? null,
    supplierSku: row.supplier_sku ?? null,
    stripePriceId: row.stripe_price_id ?? null,
    imageUrl: row.image_url ?? null,
    active: row.active,
    inventoryStatus: row.inventory_status ?? null,
    priceCents: row.price_cents ?? null,
    priceLabel: formatCents(row.price_cents)
  };
}

export function getVisibleProductVariants(variants: ProductVariantOption[]) {
  return variants.filter((variant) => variant.active && variant.inventoryStatus !== "inactive");
}

export function getSinglePurchasableVariant(variants: ProductVariantOption[]) {
  return getVisibleProductVariants(variants).find((variant) => variant.stripePriceId) ?? null;
}

export function hasRealProductVariants(variants: ProductVariantOption[]) {
  const visibleVariants = getVisibleProductVariants(variants);
  if (visibleVariants.length <= 1) return false;

  const signatures = new Set(visibleVariants.map(getVariantSignature));
  return signatures.size > 1;
}

export function getProductPriceLabel(productPriceCents: number | null | undefined, variants: ProductVariantOption[]) {
  const visibleVariants = getVisibleProductVariants(variants);
  const variantPrices = visibleVariants
    .map((variant) => variant.priceCents)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));

  if (!hasRealProductVariants(variants)) {
    return formatCents(productPriceCents ?? variantPrices[0] ?? null);
  }

  const uniquePrices = Array.from(new Set(variantPrices)).sort((a, b) => a - b);

  if (uniquePrices.length === 1) {
    return formatCents(uniquePrices[0]);
  }

  if (uniquePrices.length > 1) {
    return `From ${formatCents(uniquePrices[0])}`;
  }

  return formatCents(productPriceCents) ?? "Varied pricing";
}

export function normalizeReviewSentiment(value: string | null | undefined): ReviewSentiment | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return isReviewSentiment(normalized) ? normalized : null;
}

export function getReviewSentimentLabel(value: string | null | undefined) {
  const sentiment = normalizeReviewSentiment(value);
  return sentiment ? reviewSentimentLabels[sentiment] : null;
}

export function normalizeReviewStringList(value: unknown) {
  const rawItems = Array.isArray(value) ? value : parseJsonArray(value);
  return rawItems
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeReviewRatingBreakdown(value: unknown): ReviewRatingBreakdown {
  const rawObject = isPlainObject(value) ? value : parseJsonObject(value);
  const breakdown: ReviewRatingBreakdown = {};

  (["5", "4", "3", "2", "1"] as const).forEach((rating) => {
    const rawValue = rawObject?.[rating];
    const count = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : null;
    if (count !== null && Number.isFinite(count) && count >= 0) {
      breakdown[rating] = Math.floor(count);
    }
  });

  return breakdown;
}

export function getProductReviewSummary(product: ProductReviewFields): ProductReviewSummary | null {
  const sentiment = normalizeReviewSentiment(product.reviewSentiment);
  const summary = cleanReviewText(product.reviewSummary);
  const praise = normalizeReviewStringList(product.reviewPraise);
  const complaints = normalizeReviewStringList(product.reviewComplaints);
  const takeaway = cleanReviewText(product.reviewTakeaway);
  const ratingBreakdown = normalizeReviewRatingBreakdown(product.reviewRatingBreakdown);
  const countAnalyzed = normalizeReviewNumber(product.reviewCountAnalyzed);
  const ratingAverage = normalizeReviewNumber(product.reviewRatingAverage);
  const sourceName = cleanReviewText(product.reviewSourceName);
  const sourceUrl = cleanReviewText(product.reviewSourceUrl);
  const hasMeaningfulReviewData = Boolean(
    sentiment
    || summary
    || praise.length
    || complaints.length
    || takeaway
    || countAnalyzed !== null
    || ratingAverage !== null
    || Object.keys(ratingBreakdown).length
  );

  if (!hasMeaningfulReviewData) return null;

  return {
    sentiment,
    sentimentLabel: sentiment ? reviewSentimentLabels[sentiment] : null,
    summary,
    praise,
    complaints,
    takeaway,
    countAnalyzed,
    ratingAverage,
    ratingBreakdown,
    sourceName,
    sourceUrl
  };
}

export function getReviewPreviewText(summary: string | null | undefined) {
  const text = cleanReviewText(summary);
  if (!text) return null;

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  return sentences.slice(0, 2).join(" ");
}

export function formatReviewContext(review: Pick<ProductReviewSummary, "countAnalyzed" | "ratingAverage">) {
  const parts = [];
  if (review.countAnalyzed !== null) {
    parts.push(`Based on ${review.countAnalyzed} owner ${review.countAnalyzed === 1 ? "review" : "reviews"}`);
  }
  if (review.ratingAverage !== null) {
    parts.push(`${formatRatingAverage(review.ratingAverage)} average rating`);
  }

  return parts.join(" · ");
}

export function formatRatingBreakdownText(breakdown: ReviewRatingBreakdown) {
  const ratingNames: Record<keyof ReviewRatingBreakdown, string> = {
    "5": "five-star",
    "4": "four-star",
    "3": "three-star",
    "2": "two-star",
    "1": "one-star"
  };

  return (["5", "4", "3", "2", "1"] as const)
    .map((rating) => {
      const count = breakdown[rating] ?? 0;
      if (count <= 0) return null;
      return `${count} ${ratingNames[rating]} ${count === 1 ? "review" : "reviews"}`;
    })
    .filter(Boolean)
    .join(" · ");
}

function getVariantSignature(variant: ProductVariantOption) {
  const normalizedName = variant.variantName.trim().toLowerCase();
  const meaningfulName = placeholderVariantNames.has(normalizedName) ? "" : normalizedName;

  return [
    variant.lightPattern,
    variant.beamPattern,
    variant.lensColor,
    variant.harnessIncluded ? "harness" : "no-harness",
    variant.dielectricGreaseIncluded === null ? null : variant.dielectricGreaseIncluded ? "dielectric-grease" : "no-dielectric-grease",
    variant.protectiveFilmIncluded === null ? null : variant.protectiveFilmIncluded ? "protective-film" : "no-protective-film",
    variant.size,
    variant.finish,
    variant.sku,
    variant.supplierSku,
    meaningfulName
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

function cleanReviewText(value: string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeReviewNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function isReviewSentiment(value: string): value is ReviewSentiment {
  return value in reviewSentimentLabels;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseJsonArray(value: unknown) {
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatRatingAverage(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2).replace(/0$/, "");
}

const categoryAliases: Record<string, string> = {
  light: "lighting",
  lights: "lighting",
  lighting: "lighting",
  "offroad lighting": "lighting",
  "off-road lighting": "lighting",
  armour: "armor",
  armoury: "armor",
  recovery: "recovery",
  recoveries: "recovery",
  suspension: "suspension",
  wheels: "wheels",
  wheel: "wheels",
  tires: "tires",
  tire: "tires",
  tyres: "tires",
  tyre: "tires",
  interior: "interior",
  electronics: "interior / electronics",
  "interior electronics": "interior / electronics",
  exterior: "exterior",
  overland: "overland"
};

const categoryLabels: Record<string, string> = {
  armor: "Armor",
  exterior: "Exterior",
  "interior / electronics": "Interior / Electronics",
  lighting: "Lighting",
  overland: "Overland",
  recovery: "Recovery",
  suspension: "Suspension",
  tires: "Tires",
  "wheel hardware": "Wheel Hardware",
  wheels: "Wheels"
};

export function normalizeProductCategory(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

  return categoryAliases[normalized] ?? normalized;
}

export function displayProductCategory(value: string | null | undefined) {
  const normalized = normalizeProductCategory(value);
  if (!normalized) return "";
  if (categoryLabels[normalized]) return categoryLabels[normalized];

  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export type ProductVariantRow = {
  id: string;
  variant_name: string;
  light_pattern: string | null;
  beam_pattern?: string | null;
  lens_color: string | null;
  harness_included: boolean | null;
  dielectric_grease_included?: boolean | null;
  protective_film_included?: boolean | null;
  size?: string | null;
  finish?: string | null;
  sku?: string | null;
  supplier_sku?: string | null;
  stripe_price_id: string | null;
  image_url: string | null;
  active: boolean;
  inventory_status?: string | null;
  price_cents: number | null;
};
