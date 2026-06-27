import "server-only";
import {
  displayProductCategory,
  applyVariantAddOnPricing,
  mapVariant,
  normalizeProductCategory,
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
  category: string;
  description: string | null;
  image_url: string | null;
  price_cents?: number | null;
  stripe_price_id: string | null;
  product_images?: Array<{ url: string; sort_order: number | null }> | null;
};

type BuildProductCountRow = {
  product_id: string;
};

export async function getPartsCatalog() {
  const supabase = createSupabaseAdminClient();
  const productResult = await supabase
    .from("products")
    .select("id, slug, name, brand, category, description, image_url, price_cents, stripe_price_id, product_images(url, sort_order)")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  let productRows = productResult.data as ProductRow[] | null;
  let productError = productResult.error;

  if (productError?.code === "42703" || productError?.code === "PGRST200" || productError?.code === "PGRST204") {
    const fallback = await supabase
      .from("products")
      .select("id, name, brand, category, description, image_url, stripe_price_id")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    productRows = fallback.data as ProductRow[] | null;
    productError = fallback.error;
  }

  if (productError) {
    console.error("Parts catalog product query failed:", productError);
  }

  const productIds = (productRows ?? []).map((product) => product.id);
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

  if (variantError) console.error("Parts catalog variant query failed:", variantError);
  if ("error" in linkResult && linkResult.error) console.error("Parts catalog build count query failed:", linkResult.error);

  const variantsByProduct = new Map<string, ProductVariantRow[]>();
  (variantRows ?? []).forEach((variant) => {
    variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), variant]);
  });

  const countsByProduct = new Map<string, number>();
  ((linkResult.data ?? []) as BuildProductCountRow[]).forEach((link) => {
    countsByProduct.set(link.product_id, (countsByProduct.get(link.product_id) ?? 0) + 1);
  });
  const stripePrices = await getStripePriceMap([
    ...((productRows ?? []).map((product) => product.stripe_price_id)),
    ...((variantRows ?? []).map((variant) => variant.stripe_price_id))
  ]);

  const products: ProductSummary[] = ((productRows ?? []) as ProductRow[]).map((product) => {
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
      variants
    };
  });
  const categories = Array.from(new Map(products
    .map((product) => [normalizeProductCategory(product.category), displayProductCategory(product.category)] as const)
    .filter(([key]) => Boolean(key))).values())
    .sort((a, b) => a.localeCompare(b));

  return { products, categories };
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
