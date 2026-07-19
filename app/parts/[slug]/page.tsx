import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCheckoutButton } from "@/app/builds/[id]/ProductCheckoutButton";
import { BuildCard } from "@/components/BuildCard";
import { ProductImageCarousel, type ProductGalleryImage } from "@/components/ProductImageCarousel";
import {
  displayProductCategory,
  applyVariantAddOnPricing,
  formatRatingBreakdownText,
  formatReviewContext,
  getProductReviewSummary,
  getSinglePurchasableVariant,
  hasRealProductVariants,
  mapVariant,
  type ProductReviewFields,
  type ProductReviewSummary,
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
  install_url?: string | null;
  specs?: unknown;
  stripe_price_id: string | null;
  product_images?: Array<{ url: string | null; alt_text: string | null; sort_order: number | null }> | null;
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
} & ProductReviewFields;

type BuildProductLinkRow = {
  id: string;
  variant_id: string | null;
  notes: string | null;
  verified_builds: VerifiedBuild | VerifiedBuild[] | null;
};

type ProductImageRow = {
  url: string | null;
  alt_text: string | null;
  sort_order: number | null;
};

export default async function PartDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();
  const productResult = await supabase
    .from("products")
    .select("id, slug, name, brand, category, description, image_url, price_cents, affiliate_url, install_url, specs, stripe_price_id, review_sentiment, review_summary, review_praise, review_complaints, review_takeaway, review_count_analyzed, review_rating_average, review_rating_breakdown, review_source_name, review_source_url, product_images(url, alt_text, sort_order)")
    .eq("active", true)
    .eq("slug", slug)
    .maybeSingle();
  let product = productResult.data as ProductRow | null;
  let productError = productResult.error;

  if (!product && isUuid(slug)) {
    const idResult = await supabase
      .from("products")
      .select("id, slug, name, brand, category, description, image_url, price_cents, affiliate_url, install_url, specs, stripe_price_id, review_sentiment, review_summary, review_praise, review_complaints, review_takeaway, review_count_analyzed, review_rating_average, review_rating_breakdown, review_source_name, review_source_url, product_images(url, alt_text, sort_order)")
      .eq("active", true)
      .eq("id", slug)
      .maybeSingle();

    product = idResult.data as ProductRow | null;
    productError = idResult.error;
  }

  if (productError?.code === "42703" || productError?.code === "PGRST200" || productError?.code === "PGRST204") {
    const fallbackQuery = supabase
      .from("products")
      .select("id, slug, name, brand, category, description, image_url, stripe_price_id")
      .eq("active", true);
    const fallback = isUuid(slug)
      ? await fallbackQuery.eq("id", slug).maybeSingle()
      : await fallbackQuery.eq("slug", slug).maybeSingle();

    product = fallback.data ? mapProductReviewFields(fallback.data as ProductRow) : null;
    productError = fallback.error;
  }

  if (productError) {
    console.error("Part detail product query failed:", productError);
    notFound();
  }

  if (!product) notFound();
  product = mapProductReviewFields(product);

  const { data: productImageRows, error: productImageError } = await supabase
    .from("product_images")
    .select("url, alt_text, sort_order")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true });

  if (productImageError) {
    console.error("Part detail product image query failed:", productImageError);
    product.product_images = [];
  } else {
    product.product_images = (productImageRows ?? []) as ProductImageRow[];
  }

  const [initialVariantResult, initialLinkResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, variant_name, light_pattern, beam_pattern, lens_color, harness_included, dielectric_grease_included, protective_film_included, size, finish, sku, supplier_sku, stripe_price_id, image_url, active, inventory_status, price_cents")
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

    return applyVariantAddOnPricing({
      ...variant,
      priceCents: variantPrice.priceCents,
      priceLabel: variantPrice.priceLabel,
      priceSource: variantPrice.priceSource
    });
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
  const productGalleryImages = getProductGalleryImages(product);
  const cleanDescription = sanitizeProductDescription(product.description);
  const installInstructionsUrl = getInstallInstructionsUrl(product);
  const productSpecs = getProductSpecs(product);
  const productDetails = getProductDetailContext(product);
  const ownerReview = getProductReviewSummary(product);
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
            <ProductImageCarousel images={productGalleryImages} fallbackLabel={displayProductCategory(product.category)} />
          </div>
          <div className="part-detail-content">
            <p className="eyebrow">{[product.brand, displayProductCategory(product.category)].filter(Boolean).join(" / ")}</p>
            <h1>{product.name}</h1>
            {priceLabel ? <p className="part-detail-price">{priceLabel}</p> : null}
            {cleanDescription ? <p className="lead part-description">{cleanDescription}</p> : null}
            <div className="part-context-grid" aria-label="Part details">
              {productDetails.map((detail) => (
                <div className="part-context-item" key={detail.label}>
                  <span>{detail.label}</span>
                  <strong>{detail.value}</strong>
                </div>
              ))}
            </div>
            {productDetails.some((detail) => detail.label === "Best for") ? (
              <div className="part-best-for" aria-label="Best for">
                {getBestForPills(product).map((pill) => <span key={pill}>{pill}</span>)}
              </div>
            ) : null}
            {hasSelectableVariants ? (
              <PartVariantSelector compact variants={variants} />
            ) : singleCheckoutVariant ? (
              <div className="part-variant-panel compact">
                <div className="part-selected-variant">
                  <strong>{product.name}</strong>
                  {singleCheckoutVariant.priceLabel ? <span>{singleCheckoutVariant.priceLabel}</span> : null}
                  {!singleCheckoutVariantInStock ? <span>Out of stock</span> : null}
                </div>
                <ProductCheckoutButton disabled={!singleCheckoutVariantInStock} label="Buy this part" variantId={singleCheckoutVariant.id} />
              </div>
            ) : null}
            {productSpecs.length ? <ProductSpecs specs={productSpecs} /> : null}
            {!hasSpec(product, "Included") && getIncludedItems(product).length ? (
              <div className="part-included-box">
                <h2>What’s included</h2>
                <ul>
                  {getIncludedItems(product).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="actions part-secondary-actions">
              <Link className="button" href="/parts">Back to parts</Link>
              {installInstructionsUrl ? <a className="button" href={installInstructionsUrl} target="_blank" rel="noreferrer">View install guide</a> : null}
            </div>
          </div>
        </div>
      </section>

      {ownerReview ? (
        <section className="band">
          <div className="section">
            <OwnerReviewSection review={ownerReview} />
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
            <div className="part-empty-reference">
              <div>
                <h2>No verified builds are linked to this part yet.</h2>
                <p className="muted">Once this part appears on a verified Tacoma build, those examples will show here.</p>
              </div>
              {displayProductCategory(product.category) === "Lighting" ? (
                <Link className="button" href="/parts/packs/lighting">View Lighting Starter Pack</Link>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function mapProductReviewFields<T extends Partial<ProductRow>>(product: T): T & ProductReviewFields {
  return {
    ...product,
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
}

function OwnerReviewSection({ review }: { review: ProductReviewSummary }) {
  const reviewContext = formatReviewContext(review);
  const ratingBreakdownText = formatRatingBreakdownText(review.ratingBreakdown);

  return (
    <section className="owner-review-section" aria-labelledby="owner-review-title">
      <div className="owner-review-head">
        <div>
          <p className="eyebrow">Owner Research</p>
          <h2 id="owner-review-title">What owners say</h2>
        </div>
        {review.sentimentLabel ? (
          <p className="owner-review-sentiment">Overall sentiment: <strong>{review.sentimentLabel}</strong></p>
        ) : null}
      </div>

      {review.summary ? <p className="owner-review-summary">{review.summary}</p> : null}

      {review.praise.length || review.complaints.length ? (
        <div className="owner-review-lists">
          {review.praise.length ? <OwnerReviewList title="Common praise" items={review.praise} tone="positive" /> : null}
          {review.complaints.length ? <OwnerReviewList title="Common complaints" items={review.complaints} tone="caution" /> : null}
        </div>
      ) : null}

      {review.takeaway ? (
        <div className="owner-review-takeaway">
          <h3>Driveline takeaway</h3>
          <p>{review.takeaway}</p>
        </div>
      ) : null}

      {reviewContext || ratingBreakdownText ? (
        <div className="owner-review-context">
          {reviewContext ? <p>{reviewContext}</p> : null}
          {ratingBreakdownText ? <p>{ratingBreakdownText}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function OwnerReviewList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "caution" }) {
  return (
    <div className={`owner-review-list ${tone}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function sanitizeProductDescription(description: string | null) {
  if (!description) return null;
  return description
    .replace(/\s*Installation instructions:\s*https?:\/\/\S+/i, "")
    .trim();
}

function getInstallInstructionsUrl(product: ProductRow) {
  if (product.install_url) return product.install_url;

  if (product.slug === "morimoto-tacoma-xb-evo-amber-fog-lights") {
    return "https://www.morimotohid.com/core/media/media.nl?id=22902275&c=5129608&h=fe0YsWOvVx2_rcZeb1rkCZ9pV35LBOO_UeeM3zyuRvLV7Kx4";
  }

  return null;
}

function getProductDetailContext(product: ProductRow) {
  const details = [
    { label: "Fits", value: hasSpec(product, "Fitment") ? null : getFitmentText(product) },
    { label: "Category", value: displayProductCategory(product.category) },
    { label: "Pack", value: displayProductCategory(product.category) === "Lighting" ? "Lighting Starter Pack" : "Parts catalog" },
    { label: "Install", value: hasSpec(product, "Install") ? null : getInstallDifficulty(product) }
  ];

  return details.filter((detail) => detail.value);
}

function getProductSpecs(product: ProductRow) {
  const specs = normalizeSpecs(product.specs);
  if (isEmptySpecs(specs)) return [];

  return Object.entries(specs)
    .map(([label, value]) => [label, formatSpecValue(value)] as const)
    .filter(([, value]) => Boolean(value));
}

function ProductSpecs({ specs }: { specs: Array<readonly [string, string]> }) {
  if (!specs.length) return null;

  return (
    <section className="part-specs-panel" aria-label="Product specs">
      <h2>Product specs</h2>
      <dl>
        {specs.map(([label, value]) => (
          <div className="part-spec-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function isEmptySpecs(specs: unknown) {
  return Object.keys(normalizeSpecs(specs)).length === 0;
}

function normalizeSpecs(specs: unknown): Record<string, unknown> {
  if (!specs) return {};

  if (typeof specs === "string") {
    try {
      const parsed = JSON.parse(specs);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  if (typeof specs === "object" && !Array.isArray(specs)) {
    return specs as Record<string, unknown>;
  }

  return {};
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not listed";
  if (Array.isArray(value)) return value.map(formatSpecValue).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.entries(value)
    .map(([key, nestedValue]) => `${key}: ${formatSpecValue(nestedValue)}`)
    .filter(Boolean)
    .join(", ");
  return String(value).trim();
}

function hasSpec(product: ProductRow, label: string) {
  const specs = normalizeSpecs(product.specs);
  if (isEmptySpecs(specs)) return false;

  return Object.keys(specs).some((key) => key.toLowerCase().trim() === label.toLowerCase().trim());
}

function getFitmentText(product: ProductRow) {
  if (product.slug?.includes("morimoto-tacoma")) return "2016–2023 Toyota Tacoma";
  return "Verify against your Tacoma build";
}

function getInstallDifficulty(product: ProductRow) {
  if (product.slug === "morimoto-tacoma-xb-led-bed-lights") return "Plug-and-play";
  if (product.slug === "morimoto-tacoma-xb-evo-amber-fog-lights") return "Easy";
  return "Check product notes";
}

function getBestForPills(product: ProductRow) {
  if (hasSpec(product, "Best for")) return [];

  if (product.slug === "morimoto-tacoma-xb-evo-amber-fog-lights") {
    return ["Bad weather", "Daily driving", "OEM-plus", "Lighting pack"];
  }

  if (product.slug === "morimoto-tacoma-xb-led-bed-lights") {
    return ["Camping", "Gear loading", "Daily utility", "Lighting pack"];
  }

  return [];
}

function getIncludedItems(product: ProductRow) {
  if (product.slug === "morimoto-tacoma-xb-evo-amber-fog-lights") {
    return [
      "Pair of Morimoto XB Evo fog lights",
      "Mounting screws",
      "H11/H9/H8 connectors",
      "Optional dielectric grease",
      "Optional Yellow Lamin-X film"
    ];
  }

  if (product.slug === "morimoto-tacoma-xb-led-bed-lights") {
    return [
      "Morimoto XB LED bed lights",
      "Plug-and-play factory connectors",
      "UV-coated polycarbonate lenses"
    ];
  }

  return [];
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getProductGalleryImages(product: ProductRow): ProductGalleryImage[] {
  const galleryImages = [
    product.image_url ? { url: product.image_url, alt: "" } : null,
    ...(product.product_images ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((image) => image.url ? {
        url: image.url,
        alt: image.alt_text?.trim() || ""
      } : null)
  ].filter((image): image is ProductGalleryImage => Boolean(image?.url?.trim()));

  return Array.from(new Map(galleryImages.map((image) => {
    const cleanUrl = image.url.trim();
    return [cleanUrl, {
      url: cleanUrl,
      alt: image.alt
    }];
  })).values()).map((image, index) => ({
    ...image,
    alt: image.alt || `${product.name} product image ${index + 1}`
  }));
}
