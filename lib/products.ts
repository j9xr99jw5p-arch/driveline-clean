export type ProductVariantOption = {
  id: string;
  variantName: string;
  lightPattern: string | null;
  beamPattern: string | null;
  lensColor: string | null;
  harnessIncluded: boolean;
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
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  affiliateUrl: string | null;
  stripePriceId: string | null;
  buildCount: number;
  variants: ProductVariantOption[];
};

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

export type ProductVariantRow = {
  id: string;
  variant_name: string;
  light_pattern: string | null;
  beam_pattern?: string | null;
  lens_color: string | null;
  harness_included: boolean | null;
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
