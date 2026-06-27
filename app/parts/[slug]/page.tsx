import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCheckoutButton } from "@/app/builds/[id]/ProductCheckoutButton";
import { BuildCard } from "@/components/BuildCard";
import { ExpandableText } from "@/components/ExpandableText";
import {
  displayProductCategory,
  getSinglePurchasableVariant,
  hasRealProductVariants,
  mapVariant,
  type ProductVariantRow
} from "@/lib/products";
import { getStripePriceMap, resolveDisplayPrice } from "@/lib/stripePrices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { VerifiedBuild } from "@/lib/types";
import { PartVariantSelector } from "./PartVariantSelector";

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
  order_url?: string | null;
  stripe_price_id: string | null;
  product_images?: Array<{ url: string; sort_order: number | null }> | null;
};

type BuildProductLinkRow = {
  id: string;
  variant_id: string | null;
  notes: string | null;
  verified_builds: VerifiedBuild | VerifiedBuild[] | null;
};

export default async function PartDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();
  const productResult = await supabase
    .from("products")
    .select("id, slug, name, brand, category, description, image_url, price_cents, affiliate_url, order_url, stripe_price_id, product_images(url, sort_order)")
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();
  let product = productResult.data as ProductRow | null;
  let productError = productResult.error;

  if (!product && isUuid(slug)) {
    const idResult = await supabase
      .from("products")
      .select("id, slug, name, brand, category, description, image_url, price_cents, affiliate_url, order_url, stripe_price_id, product_images(url, sort_order)")
      .eq("active", true)
      .eq("id", slug)
      .maybeSingle();

    product = idResult.data as ProductRow | null;
    productError = idResult.error;
  }

  if (productError?.code === "42703" || productError?.code === "PGRST200" || productError?.code === "PGRST204") {
    const fallback = await supabase
      .from("products")
      .select("id, name, brand, category, description, image_url, order_url, stripe_price_id")
      .eq("active", true)
      .eq("id", slug)
      .maybeSingle();

    product = fallback.data as ProductRow | null;
    productError = fallback.error;
  }

  if (productError) {
    console.error("Part detail product query failed:", productError);
    notFound();
  }

  if (!product) notFound();

  const [initialVariantResult, initialLinkResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, variant_name, light_pattern, beam_pattern, lens_color, harness_included, size, finish, sku, supplier_sku, stripe_price_id, image_url, active, inventory_status, price_cents")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("variant_name", { ascending: true }),
    supabase
      .from("build_products")
      .select("id, variant_id, notes, verified_builds!inner(*, verified_build_photos(*))")
      .eq("product_id", product.id)
      .eq("verified_builds.published", true)
      .order("display_order", { ascending: true })
  ]);
  let variantRows = initialVariantResult.data as ProductVariantRow[] | null;
  let variantError = initialVariantResult.error;
  let linkRows = initialLinkResult.data as BuildProductLinkRow[] | null;
  let linkError = initialLinkResult.error;

  if (variantError?.code === "42703" || variantError?.code === "PGRST204") {
    const fallbackVariants = await supabase
      .from("product_variants")
      .select("id, variant_name, light_pattern, beam_pattern, lens_color, harness_included, stripe_price_id, image_url, active, inventory_status, price_cents")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("variant_name", { ascending: true });

    variantRows = fallbackVariants.data as ProductVariantRow[] | null;
    variantError = fallbackVariants.error;
  }

  if (linkError?.code === "42703" || linkError?.code === "PGRST204") {
    const fallbackLinks = await supabase
      .from("build_products")
      .select("id, verified_builds!inner(*, verified_build_photos(*))")
      .eq("product_id", product.id)
      .eq("verified_builds.published", true)
      .order("display_order", { ascending: true });

    linkRows = fallbackLinks.data as BuildProductLinkRow[] | null;
    linkError = fallbackLinks.error;
  }

  if (variantError) console.error("Part detail variants query failed:", variantError);
  if (linkError) console.error("Part detail build links query failed:", linkError);

  const stripePrices = await getStripePriceMap([
    product.stripe_price_id,
    ...(variantRows ?? []).map((variant) => variant.stripe_price_id)
  ]);
  const variants = (variantRows ?? []).map((variantRow) => {
    const variant = mapVariant(variantRow);
    const variantPrice = resolveDisplayPrice({
      stripePriceId: variant.stripePriceId,
      priceCents: variant.priceCents
    }, stripePrices);

    return {
      ...variant,
      priceCents: variantPrice.priceCents,
      priceLabel: variantPrice.priceLabel,
      priceSource: variantPrice.priceSource
    };
  });
  const hasSelectableVariants = hasRealProductVariants(variants);
  const singleCheckoutVariant = !hasSelectableVariants ? getSinglePurchasableVariant(variants) : null;
  const singleCheckoutVariantInStock = singleCheckoutVariant ? singleCheckoutVariant.inventoryStatus !== "out_of_stock" : false;
  const firstVariantPrice = variants.find((variant) => variant.priceSource !== "unavailable") ?? null;
  const displayPrice = resolveDisplayPrice({
    stripePriceId: product.stripe_price_id,
    priceCents: product.price_cents ?? firstVariantPrice?.priceCents ?? null
  }, stripePrices);
  const priceLabel = displayPrice.priceLabel;
  const productImageUrls = getProductImageUrls(product);
  const primaryImageUrl = productImageUrls[0] ?? null;
  const buildLinks = (linkRows ?? [])
    .map((link) => {
      const build = Array.isArray(link.verified_builds) ? link.verified_builds[0] : link.verified_builds;
      const variant = variants.find((option) => option.id === link.variant_id);
      return build ? { build, variant, notes: link.notes } : null;
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  return (
    <>
      <section className="band">
        <div className="section part-detail-layout">
          <div className="part-detail-image">
            {primaryImageUrl ? (
              <span className="part-image-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="part-image-bg" src={primaryImageUrl} alt="" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="part-image-main" src={primaryImageUrl} alt={product.name} />
              </span>
            ) : <span>{displayProductCategory(product.category)}</span>}
            {productImageUrls.length > 1 ? (
              <div className="part-image-strip" aria-label="Additional product images">
                {productImageUrls.map((imageUrl, index) => (
                  <a href={imageUrl} key={imageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={`${product.name} image ${index + 1}`} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="part-detail-content">
            <p className="eyebrow">{[product.brand, displayProductCategory(product.category)].filter(Boolean).join(" / ")}</p>
            <h1>{product.name}</h1>
            {priceLabel ? <p className="part-detail-price">{priceLabel}</p> : null}
            {product.description ? <ExpandableText text={product.description} className="lead part-description" /> : null}
            <div className="actions" style={{ justifyContent: "flex-start" }}>
              <Link className="button" href="/parts">Back to parts</Link>
            </div>
          </div>
        </div>
      </section>

      {hasSelectableVariants ? (
        <section className="band alt">
          <div className="section">
            <PartVariantSelector variants={variants} />
          </div>
        </section>
      ) : singleCheckoutVariant ? (
        <section className="band alt">
          <div className="section">
            <div className="card part-variant-panel">
              <div>
                <p className="eyebrow">Checkout</p>
                <h2>Ready to shop this part?</h2>
              </div>
              <div className="part-selected-variant">
                <strong>{product.name}</strong>
                {singleCheckoutVariant.priceLabel ? <span>{singleCheckoutVariant.priceLabel}</span> : null}
                {!singleCheckoutVariantInStock ? <span>Out of stock</span> : null}
              </div>
              <ProductCheckoutButton disabled={!singleCheckoutVariantInStock} variantId={singleCheckoutVariant.id} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="band">
        <div className="section">
          <div className="section-heading">
            <p className="eyebrow">Verified Builds</p>
            <h2>Verified builds using this part</h2>
          </div>
          {buildLinks.length ? (
            <div className="grid three">
              {buildLinks.map(({ build, variant, notes }) => (
                <div className="part-build-card" key={build.id}>
                  <BuildCard build={build} />
                  {variant || notes ? (
                    <div className="part-build-meta">
                      {variant ? <span>{variant.variantName}</span> : null}
                      {notes ? <span>{notes}</span> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <h2>No published builds are linked yet.</h2>
              <p className="muted">Link this product to a verified build to show it here.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
