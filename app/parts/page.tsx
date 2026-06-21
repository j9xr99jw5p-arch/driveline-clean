import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatCents, mapVariant, type ProductSummary, type ProductVariantRow } from "@/lib/products";
import { PartsGrid } from "./PartsGrid";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  slug?: string | null;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  image_url: string | null;
  price_cents?: number | null;
  affiliate_url?: string | null;
  stripe_price_id: string | null;
};

type BuildProductCountRow = {
  product_id: string;
};

export default async function PartsPage() {
  const supabase = createSupabaseAdminClient();
  const productResult = await supabase
    .from("products")
    .select("id, slug, name, brand, category, description, image_url, price_cents, affiliate_url, stripe_price_id")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  let productRows = productResult.data as ProductRow[] | null;
  let productError = productResult.error;

  if (productError?.code === "42703" || productError?.code === "PGRST204") {
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
    console.error("Parts page product query failed:", productError);
  }

  const productIds = (productRows ?? []).map((product) => product.id);
  const [initialVariantResult, linkResult] = productIds.length
    ? await Promise.all([
        supabase
          .from("product_variants")
          .select("id, product_id, variant_name, light_pattern, beam_pattern, lens_color, harness_included, size, finish, sku, supplier_sku, stripe_price_id, image_url, active, inventory_status, price_cents")
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

  if (variantError) console.error("Parts page variant query failed:", variantError);
  if ("error" in linkResult && linkResult.error) console.error("Parts page build count query failed:", linkResult.error);

  const variantsByProduct = new Map<string, ProductVariantRow[]>();
  (variantRows ?? []).forEach((variant) => {
    variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), variant]);
  });

  const countsByProduct = new Map<string, number>();
  ((linkResult.data ?? []) as BuildProductCountRow[]).forEach((link) => {
    countsByProduct.set(link.product_id, (countsByProduct.get(link.product_id) ?? 0) + 1);
  });

  const products: ProductSummary[] = ((productRows ?? []) as ProductRow[]).map((product) => {
    const variants = (variantsByProduct.get(product.id) ?? []).map(mapVariant);
    const firstVariantPrice = variants.find((variant) => variant.priceCents !== null)?.priceCents ?? null;

    return {
      id: product.id,
      slug: product.slug ?? product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
      imageUrl: product.image_url,
      priceCents: product.price_cents ?? firstVariantPrice,
      priceLabel: formatCents(product.price_cents ?? firstVariantPrice),
      affiliateUrl: product.affiliate_url ?? null,
      stripePriceId: product.stripe_price_id,
      buildCount: countsByProduct.get(product.id) ?? 0,
      variants
    };
  });

  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Driveline Parts</p>
          <h1>Browse Parts</h1>
          <p className="lead">Find parts used on verified Tacoma builds, then open each part to see the builds running it.</p>
        </div>
        <PartsGrid products={products} />
      </div>
    </section>
  );
}
