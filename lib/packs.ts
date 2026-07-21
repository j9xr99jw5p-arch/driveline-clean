import "server-only";
import {
  applyVariantAddOnPricing,
  displayProductCategory,
  mapVariant,
  type ProductSummary,
  type ProductVariantRow
} from "@/lib/products";
import { getStripePriceMap, resolveDisplayPrice } from "@/lib/stripePrices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PackCheckoutRow } from "@/lib/packCheckout";

export type PackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type PackProduct = ProductSummary & {
  inventoryStatus: string | null;
  packQuantity: number;
  selectedByDefault: boolean;
  packSortOrder: number;
};

export type ProductPack = PackSummary & {
  products: PackProduct[];
};

export type PackLookupResult =
  | { status: "found"; pack: ProductPack }
  | { status: "not_found" }
  | { status: "error" };

type ProductRow = {
  id: string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  stripe_price_id: string | null;
  active: boolean;
  inventory_status?: string | null;
  product_images?: Array<{ url: string | null; sort_order: number | null }> | null;
  product_variants?: Array<ProductVariantRow & { product_id: string }> | null;
};

type PackProductRow = {
  sort_order: number | null;
  quantity: number | null;
  selected_by_default: boolean | null;
  products: ProductRow | ProductRow[] | null;
};

type PackRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  pack_products?: PackProductRow[] | null;
};

type PackQueryResult =
  | { status: "found"; row: PackRow }
  | { status: "not_found" }
  | { status: "error" };

export async function getActivePackSummaries(): Promise<PackSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("packs")
    .select(`
      id,
      slug,
      name,
      description,
      sort_order,
      pack_products (
        products (
          active
        )
      )
    `)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Pack summary query failed:", error);
    return [];
  }

  return ((data ?? []) as PackRow[])
    .filter((row) => getActivePackProducts(row).length > 0)
    .map(mapPackSummary);
}

export async function getActivePackBySlug(slug: string): Promise<PackLookupResult> {
  const packResult = await getActivePackProductRowsBySlug(slug);

  if (packResult.status !== "found") {
    return packResult;
  }

  const row = packResult.row;
  const productRows = getActivePackProducts(row);
  const stripePrices = await getStripePriceMap(getPackStripePriceIds(productRows));

  return {
    status: "found",
    pack: {
      ...mapPackSummary(row),
      products: mapVisiblePackProducts(row, stripePrices)
    }
  };
}

export async function getActivePackCheckoutRowBySlug(slug: string): Promise<PackQueryResult & { row?: PackRow & PackCheckoutRow }> {
  const packResult = await getActivePackProductRowsBySlug(slug);

  if (packResult.status !== "found") {
    return packResult;
  }

  return {
    status: "found",
    row: toPackCheckoutRow(packResult.row) as PackRow & PackCheckoutRow
  };
}

async function getActivePackProductRowsBySlug(slug: string): Promise<PackQueryResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("packs")
    .select(`
      id,
      slug,
      name,
      description,
      sort_order,
      pack_products (
        sort_order,
        quantity,
        selected_by_default,
        products (
          id,
          slug,
          name,
          brand,
          category,
          description,
          image_url,
          price_cents,
          stripe_price_id,
          active,
          inventory_status,
          product_images (
            url,
            sort_order
          ),
          product_variants (
            id,
            product_id,
            variant_name,
            light_pattern,
            beam_pattern,
            lens_color,
            harness_included,
            dielectric_grease_included,
            protective_film_included,
            stripe_price_id,
            image_url,
            active,
            inventory_status,
            price_cents
          )
        )
      )
    `)
    .eq("active", true)
    .eq("slug", normalizePackSlug(slug))
    .order("sort_order", { referencedTable: "pack_products", ascending: true })
    .maybeSingle();

  if (error) {
    console.error("Pack detail query failed:", error);
    return { status: "error" };
  }

  if (!data) {
    return { status: "not_found" };
  }

  return {
    status: "found",
    row: data as PackRow
  };
}

export async function getActivePacks(): Promise<ProductPack[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("packs")
    .select(`
      id,
      slug,
      name,
      description,
      sort_order,
      pack_products (
        sort_order,
        quantity,
        selected_by_default,
        products (
          id,
          slug,
          name,
          brand,
          category,
          description,
          image_url,
          price_cents,
          stripe_price_id,
          active,
          inventory_status,
          product_images (
            url,
            sort_order
          ),
          product_variants (
            id,
            product_id,
            variant_name,
            light_pattern,
            beam_pattern,
            lens_color,
            harness_included,
            dielectric_grease_included,
            protective_film_included,
            stripe_price_id,
            image_url,
            active,
            inventory_status,
            price_cents
          )
        )
      )
    `)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("sort_order", { referencedTable: "pack_products", ascending: true });

  if (error) {
    console.error("Pack query failed:", error);
    return [];
  }

  const rows = (data ?? []) as PackRow[];
  const productRows = rows
    .flatMap((pack) => pack.pack_products ?? [])
    .map((item) => Array.isArray(item.products) ? item.products[0] : item.products)
    .filter(isActivePackProduct);
  const stripePrices = await getStripePriceMap(getPackStripePriceIds(productRows));

  return rows
    .map((row) => ({
      ...mapPackSummary(row),
      products: dedupePackProducts((row.pack_products ?? [])
        .map((item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          if (!isActivePackProduct(product)) return null;
          return mapPackProduct(product, item, stripePrices);
        })
        .filter((product): product is PackProduct => Boolean(product)))
    }))
    .filter((pack) => pack.products.length > 0);
}

function getActivePackProducts(row: PackRow) {
  return (row.pack_products ?? [])
    .map((item) => Array.isArray(item.products) ? item.products[0] : item.products)
    .filter(isActivePackProduct);
}

function isActivePackProduct(product: ProductRow | null | undefined): product is ProductRow {
  return Boolean(product?.active && product.inventory_status !== "inactive");
}

function normalizePackSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function mapPackSummary(row: PackRow): PackSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order ?? 0
  };
}

function mapPackProduct(
  product: ProductRow,
  item: PackProductRow,
  stripePrices: Awaited<ReturnType<typeof getStripePriceMap>>
): PackProduct {
  const price = resolveDisplayPrice({
    stripePriceId: product.stripe_price_id,
    priceCents: product.price_cents
  }, stripePrices);
  const variants = (product.product_variants ?? [])
    .filter((variant) => variant.active && variant.inventory_status !== "inactive")
    .map((variantRow) => {
      const variant = mapVariant(variantRow);
      const variantPrice = resolveDisplayPrice({
        stripePriceId: variant.stripePriceId,
        priceCents: variant.priceCents
      }, stripePrices);

      return applyVariantAddOnPricing({
        ...variant,
        priceCents: variantPrice.priceCents,
        priceLabel: variantPrice.priceLabel,
        priceSource: variantPrice.priceSource
      });
    });

  return {
    id: product.id,
    slug: product.slug ?? product.id,
    name: product.name,
    brand: product.brand,
    category: displayProductCategory(product.category),
    description: product.description,
    imageUrl: getProductCardImageUrl(product),
    imageUrls: getProductImageUrls(product),
    priceCents: price.priceCents,
    priceLabel: price.priceLabel,
    priceSource: price.priceSource,
    stripePriceId: product.stripe_price_id,
    inventoryStatus: product.inventory_status ?? null,
    buildCount: 0,
    variants,
    reviewSentiment: null,
    reviewSummary: null,
    reviewPraise: null,
    reviewComplaints: null,
    reviewTakeaway: null,
    reviewCountAnalyzed: null,
    reviewRatingAverage: null,
    reviewRatingBreakdown: null,
    reviewSourceName: null,
    reviewSourceUrl: null,
    packQuantity: Math.max(1, Math.min(10, item.quantity ?? 1)),
    selectedByDefault: item.selected_by_default ?? true,
    packSortOrder: item.sort_order ?? 0
  };
}

function mapVisiblePackProducts(
  row: PackRow,
  stripePrices: Awaited<ReturnType<typeof getStripePriceMap>>
) {
  return dedupePackProducts((row.pack_products ?? [])
    .map((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      if (!isActivePackProduct(product)) return null;
      return mapPackProduct(product, item, stripePrices);
    })
    .filter((product): product is PackProduct => Boolean(product)));
}

function toPackCheckoutRow(row: PackRow): PackCheckoutRow {
  const packProducts: NonNullable<PackCheckoutRow["pack_products"]> = [];

  (row.pack_products ?? []).forEach((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!isActivePackProduct(product)) return;

    packProducts.push({
      product_id: product.id,
      products: {
        id: product.id,
        name: product.name,
        category: displayProductCategory(product.category),
        description: product.description,
        image_url: getProductCardImageUrl(product),
        price_cents: product.price_cents,
        stripe_price_id: product.stripe_price_id,
        active: product.active,
        inventory_status: product.inventory_status ?? null,
        product_variants: (product.product_variants ?? [])
          .filter((variant) => variant.active && variant.inventory_status !== "inactive")
          .map((variant) => ({
            id: variant.id,
            product_id: variant.product_id,
            variant_name: variant.variant_name,
            stripe_price_id: variant.stripe_price_id,
            active: variant.active,
            inventory_status: variant.inventory_status ?? null,
            price_cents: variant.price_cents
          }))
      }
    });
  });

  return {
    id: row.id,
    slug: row.slug,
    pack_products: packProducts
  };
}

function getProductCardImageUrl(product: ProductRow) {
  return getProductImageUrls(product)[0] ?? null;
}

function getProductImageUrls(product: ProductRow) {
  const imageUrls = (product.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image) => image.url?.trim())
    .filter((url): url is string => Boolean(url));

  if (!imageUrls.length && product.image_url?.trim()) {
    imageUrls.push(product.image_url.trim());
  }

  return imageUrls;
}

function getPackStripePriceIds(products: ProductRow[]) {
  return products.flatMap((product) => [
    product.stripe_price_id,
    ...(product.product_variants ?? [])
      .filter((variant) => variant.active && variant.inventory_status !== "inactive")
      .map((variant) => variant.stripe_price_id)
  ]);
}

function dedupePackProducts(products: PackProduct[]) {
  return Array.from(new Map(products.map((product) => [product.id, product])).values())
    .sort((a, b) => a.name.localeCompare(b.name));
}
