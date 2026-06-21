import { notFound } from "next/navigation";
import { BuildPhotoCarousel, type BuildPhoto } from "@/components/BuildPhotoCarousel";
import { ExpandableText } from "@/components/ExpandableText";
import { cleanJoin, formatBoolean, formatBuildTitle, formatSuspension, formatWheelTireCombo } from "@/lib/buildDisplay";
import { getPublicSocialHandle, sanitizePublicBuildNotes } from "@/lib/buildPrivacy";
import { getReviewedBuildSummary } from "@/lib/buildSummary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import type { VerifiedBuild } from "@/lib/types";
import {
  BuildProductCarousel,
  type BuildProductCardData,
  type BuildProductVariantData
} from "./BuildProductCarousel";

type BuildProductRow = {
  id: string;
  product_type: string | null;
  variant_id: string | null;
  notes: string | null;
  display_order: number | null;
  products: BuildProduct | BuildProduct[] | null;
};

type BuildProduct = {
    id: string;
    slug: string | null;
    name: string;
    brand: string | null;
    category: string;
    description: string | null;
    image_url: string | null;
    order_url: string | null;
    stripe_price_id: string | null;
    product_variants?: BuildProductVariant[] | null;
};

type BuildProductVariant = {
  id: string;
  variant_name: string;
  light_pattern: string | null;
  beam_pattern: string | null;
  lens_color: string | null;
  harness_included: boolean | null;
  size: string | null;
  finish: string | null;
  sku: string | null;
  supplier_sku: string | null;
  stripe_price_id: string;
  image_url: string | null;
  active: boolean;
  inventory_status: string | null;
  price_cents: number | null;
};

const priceLabelsByStripePriceId: Record<string, string> = {
  price_1TkUDzAxOgxntpwRJ97keK60: "$2,519.95",
  price_1TkUmQAxOgxntpwRkHxLMzbz: "$89.95",
  price_1TkVCWAxOgxntpwR73QN8vJo: "$209.99",
  price_1TkVa0AxOgxntpwR6e15v37S: "$509.99"
};

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseServerEnv()) notFound();

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: build } = await supabase
    .from("verified_builds")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (!build) notFound();

  const { data: photos } = await supabase
    .from("verified_build_photos")
    .select("id, url, alt_text")
    .eq("build_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const admin = createSupabaseAdminClient();
  const productLinksResult = await admin
    .from("build_products")
    .select(`
      id,
      product_type,
      variant_id,
      notes,
      display_order,
      products (
        id,
        slug,
        name,
        brand,
        category,
        description,
        image_url,
        order_url,
        stripe_price_id,
        product_variants (
          id,
          variant_name,
          light_pattern,
          beam_pattern,
          lens_color,
          harness_included,
          size,
          finish,
          sku,
          supplier_sku,
          stripe_price_id,
          image_url,
          active,
          inventory_status,
          price_cents
        )
      )
    `)
    .eq("build_id", id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  let productLinks: unknown = productLinksResult.data;
  const productLinksError = productLinksResult.error;

  if (productLinksError?.code === "42703" || productLinksError?.code === "PGRST204") {
    const fallback = await admin
      .from("build_products")
      .select(`
        id,
        product_type,
        variant_id,
        display_order,
        products (
          id,
          name,
          brand,
          category,
          description,
          image_url,
          stripe_price_id,
          product_variants (
          id,
          variant_name,
          stripe_price_id,
          image_url,
          active,
            inventory_status
          )
        )
      `)
      .eq("build_id", id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    productLinks = fallback.data;
  }

  const typedBuild = build as VerifiedBuild;
  const title = formatBuildTitle(typedBuild);
  const socialHandle = getPublicSocialHandle(typedBuild);
  const publicNotes = sanitizePublicBuildNotes(typedBuild.notes);
  const buildSummary = getReviewedBuildSummary(typedBuild);
  const products = ((productLinks ?? []) as BuildProductRow[])
    .map((link) => {
      const product = Array.isArray(link.products) ? link.products[0] : link.products;
      if (!product) return null;
      const variants: BuildProductVariantData[] = (product.product_variants ?? [])
        .filter((variant) => variant.active)
        .map((variant) => ({
          id: variant.id,
          variantName: variant.variant_name,
          lightPattern: variant.light_pattern ?? variant.beam_pattern ?? null,
          beamPattern: variant.beam_pattern ?? null,
          lensColor: variant.lens_color ?? null,
          harnessIncluded: Boolean(variant.harness_included),
          size: variant.size ?? null,
          finish: variant.finish ?? null,
          sku: variant.sku ?? null,
          supplierSku: variant.supplier_sku ?? null,
          imageUrl: variant.image_url,
          inventoryStatus: variant.inventory_status,
          priceLabel: variant.price_cents ? formatCents(variant.price_cents) : priceLabelsByStripePriceId[variant.stripe_price_id] ?? null
        }));
      const linkedVariant = variants.find((variant) => variant.id === link.variant_id);

      return {
        id: product.id,
        slug: product.slug ?? product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
        imageUrl: product.image_url,
        orderUrl: "order_url" in product ? product.order_url : null,
        linkedVariantLabel: linkedVariant ? linkedVariant.variantName : null,
        linkNotes: link.notes,
        variants
      };
    })
    .filter((product): product is BuildProductCardData => Boolean(product && product.variants.length > 0));

  return (
    <>
      <section className="band">
        <div className="section build-detail-layout">
          <BuildPhotoCarousel photos={(photos ?? []) as BuildPhoto[]} title={title} />
          <div className="build-detail-content">
            <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
            <h1 className="build-detail-title">{title}</h1>
            <div className="build-story">
              <p>{buildSummary}</p>
            </div>
            <div className="build-facts" aria-label="Build facts">
              {[
              ["Wheel / tire", formatWheelTireCombo(typedBuild)],
              ["Suspension", formatSuspension(typedBuild)],
              ["Cab / Bed", cleanJoin([typedBuild.cab, typedBuild.bed], " / ")],
              ["Rubbing", typedBuild.rubbing_severity],
              ["Trimming", formatBoolean(typedBuild.trimming_required)],
              ["Body mount chop", formatBoolean(typedBuild.body_mount_chop)],
              ["Social", socialHandle]
              ].map(([label, value]) => (
                <div className="build-fact" key={label}><span>{label}</span><strong>{value || "Unknown"}</strong></div>
              ))}
            </div>
            {publicNotes ? <ExpandableText text={publicNotes} className="lead build-notes" /> : null}
          </div>
        </div>
      </section>

      {products.length ? (
        <section className="band">
          <div className="section">
            <div className="section-heading">
              <p className="eyebrow">Build Parts</p>
              <h2>Parts on this build</h2>
            </div>
            <BuildProductCarousel products={products} buildId={id} />
          </div>
        </section>
      ) : null}
    </>
  );
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}
