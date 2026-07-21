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

export type PackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type PackProduct = ProductSummary & {
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
  product_variants?: ProductVariantRow[] | null;
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

export async function getActivePackSummaries(): Promise<PackSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("packs")
    .select("id, slug, name, description, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Pack summary query failed:", error);
    return [];
  }

  return ((data ?? []) as PackRow[]).map(mapPackSummary);
}

export async function getActivePackBySlug(slug: string): Promise<PackLookupResult> {
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
    .eq("slug", slug)
    .order("sort_order", { referencedTable: "pack_products", ascending: true })
    .maybeSingle();

  if (error) {
    console.error("Pack detail query failed:", error);
    return { status: "error" };
  }

  if (!data) {
    return { status: "not_found" };
  }

  const row = data as PackRow;
  const productRows = (row.pack_products ?? [])
    .map((item) => Array.isArray(item.products) ? item.products[0] : item.products)
    .filter((product): product is ProductRow => Boolean(product?.active));
  const stripePrices = await getStripePriceMap(getPackStripePriceIds(productRows));

  return {
    status: "found",
    pack: {
      ...mapPackSummary(row),
      products: dedupePackProducts((row.pack_products ?? [])
        .map((item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          if (!product?.active) return null;
          return mapPackProduct(product, item, stripePrices);
        })
        .filter((product): product is PackProduct => Boolean(product)))
    }
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
    .filter((product): product is ProductRow => Boolean(product?.active));
  const stripePrices = await getStripePriceMap(getPackStripePriceIds(productRows));

  return rows.map((row) => ({
    ...mapPackSummary(row),
    products: dedupePackProducts((row.pack_products ?? [])
      .map((item) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        if (!product?.active) return null;
        return mapPackProduct(product, item, stripePrices);
      })
      .filter((product): product is PackProduct => Boolean(product)))
  }));
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
    .sort((a, b) => a.packSortOrder - b.packSortOrder || a.name.localeCompare(b.name));
}
