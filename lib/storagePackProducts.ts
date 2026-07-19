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

type ProductRow = {
  id: string;
  slug?: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  price_cents?: number | null;
  stripe_price_id: string | null;
  active: boolean;
  product_images?: Array<{ url: string; sort_order: number | null }> | null;
  review_sentiment?: string | null;
  review_summary?: string | null;
  review_praise?: unknown;
  review_complaints?: unknown;
  review_takeaway?: string | null;
  review_count_analyzed?: number | null;
  review_rating_average?: number | null;
  review_rating_breakdown?: unknown;
  review_source_name?: string | null;
  review_source_url?: string | null;
};

type BuildProductCountRow = {
  product_id: string;
};

export async function getStoragePackProducts(): Promise<{ products: ProductSummary[]; error: boolean }> {
  const productResult = await getStorageProductRows();
  if (productResult.error) return { products: [], error: true };

  const storageRows = productResult.products;
  const productIds = storageRows.map((product) => product.id);
  const supabase = createSupabaseAdminClient();
  const [initialVariantResult, linkResult] = productIds.length
    ? await Promise.all([
        supabase
          .from("product_variants")
          .select("id, product_id, variant_name, light_pattern, beam_pattern, lens_color, harness_included, dielectric_grease_included, protective_film_included, size, finish, sku, supplier_sku, stripe_price_id, image_url, active, inventory_status, price_cents")
          .in("product_id", productIds)
          .eq("active", true),
        supabase
          .from("build_products")
          .select("product_id, verified_builds!inner(id, published)")
          .in("product_id", productIds)
          .eq("verified_builds.published", true)
      ])
    : [{ data: [] }, { data: [] }];
  let variantRows = initialVariantResult.data as Array<ProductVariantRow & { product_id: string }> | null;
  let variantError = "error" in initialVariantResult ? initialVariantResult.error : null;

  if (variantError?.code === "42703" || variantError?.code === "PGRST204") {
    const fallbackVariants = await supabase
      .from("product_variants")
      .select("id, product_id, variant_name, light_pattern, beam_pattern, lens_color, harness_included, stripe_price_id, image_url, active, inventory_status, price_cents")
      .in("product_id", productIds)
      .eq("active", true);

    variantRows = fallbackVariants.data as Array<ProductVariantRow & { product_id: string }> | null;
    variantError = fallbackVariants.error;
  }

  if (variantError) console.error("Storage pack variant query failed:", variantError);
  if ("error" in linkResult && linkResult.error) console.error("Storage pack build count query failed:", linkResult.error);

  const variantsByProduct = new Map<string, ProductVariantRow[]>();
  (variantRows ?? []).forEach((variant) => {
    variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), variant]);
  });

  const countsByProduct = new Map<string, number>();
  ((linkResult.data ?? []) as BuildProductCountRow[]).forEach((link) => {
    countsByProduct.set(link.product_id, (countsByProduct.get(link.product_id) ?? 0) + 1);
  });

  const stripePrices = await getStripePriceMap([
    ...storageRows.map((product) => product.stripe_price_id),
    ...((variantRows ?? []).map((variant) => variant.stripe_price_id))
  ]);

  return {
    products: storageRows.map((product) => {
      const variants = (variantsByProduct.get(product.id) ?? []).map((variantRow) => {
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
      const productImageUrls = getProductImageUrls(product);
      const firstVariantPrice = variants.find((variant) => variant.priceSource !== "unavailable") ?? null;
      const productPrice = resolveDisplayPrice({
        stripePriceId: product.stripe_price_id,
        priceCents: product.price_cents ?? firstVariantPrice?.priceCents ?? null
      }, stripePrices);

      return {
        id: product.id,
        slug: product.slug ?? product.id,
        name: product.name,
        brand: product.brand,
        category: displayProductCategory(product.category),
        description: product.description,
        imageUrl: productImageUrls[0] ?? null,
        imageUrls: productImageUrls,
        priceCents: productPrice.priceCents,
        priceLabel: productPrice.priceLabel,
        priceSource: productPrice.priceSource,
        stripePriceId: product.stripe_price_id,
        buildCount: countsByProduct.get(product.id) ?? 0,
        variants,
        reviewSentiment: product.review_sentiment ?? null,
        reviewSummary: product.review_summary ?? null,
        reviewPraise: product.review_praise ?? null,
        reviewComplaints: product.review_complaints ?? null,
        reviewTakeaway: product.review_takeaway ?? null,
        reviewCountAnalyzed: product.review_count_analyzed ?? null,
        reviewRatingAverage: product.review_rating_average ?? null,
        reviewRatingBreakdown: product.review_rating_breakdown ?? null,
        reviewSourceName: product.review_source_name ?? null,
        reviewSourceUrl: product.review_source_url ?? null
      };
    }),
    error: false
  };
}

export async function getStorageProductRows(): Promise<{ products: ProductRow[]; error: boolean }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, brand, category, description, image_url, price_cents, stripe_price_id, active, review_sentiment, review_summary, review_praise, review_complaints, review_takeaway, review_count_analyzed, review_rating_average, review_rating_breakdown, review_source_name, review_source_url, product_images(url, sort_order)")
    .eq("active", true)
    .eq("category", "Storage")
    .order("name", { ascending: true });

  if (error) {
    console.error("Storage pack product query failed:", error);
    return { products: [], error: true };
  }

  const products = (data ?? []) as ProductRow[];
  const storageProducts = products.filter(isStorageProduct);

  return {
    products: dedupeProductsById(storageProducts),
    error: false
  };
}

export function isStorageProduct(product: Pick<ProductRow, "active" | "category">) {
  return product.active === true && normalizeStorageCategory(product.category) === "storage";
}

function normalizeStorageCategory(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function dedupeProductsById(products: ProductRow[]) {
  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}

function getProductImageUrls(product: ProductRow) {
  const imageUrls = (product.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image) => image.url)
    .filter(Boolean);

  if (product.image_url && !imageUrls.includes(product.image_url)) {
    imageUrls.push(product.image_url);
  }

  return imageUrls;
}
