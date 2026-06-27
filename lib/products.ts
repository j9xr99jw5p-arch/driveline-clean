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
