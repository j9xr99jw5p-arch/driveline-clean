import { NextResponse } from "next/server";
import { z } from "zod";
import { getVariantAddOnPriceCents } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const schema = z.object({
  variantId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(20).optional(),
  buildId: z.string().uuid().optional()
}).refine((payload) => Boolean(payload.variantId) !== Boolean(payload.productId), {
  message: "Choose exactly one product or product option."
});

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

type CheckoutVariant = {
  id: string;
  product_id: string;
  variant_name: string;
  light_pattern: string | null;
  lens_color: string | null;
  harness_included: boolean | null;
  dielectric_grease_included?: boolean | null;
  protective_film_included?: boolean | null;
  stripe_price_id: string | null;
  active: boolean;
  inventory_status: string | null;
};

type CheckoutProduct = {
  id: string;
  name: string;
  active: boolean;
  stripe_price_id: string | null;
  inventory_status?: string | null;
};

function devLog(message: string, details?: unknown) {
  if (process.env.NODE_ENV !== "production") console.log(message, details ?? "");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please choose a valid product." }, { status: 400 });
  }

  const { variantId, productId, buildId } = parsed.data;
  const quantity = parsed.data.quantity ?? 1;

  devLog("Product checkout request:", { variantId, productId });

  const supabase = createSupabaseAdminClient();
  let variant: CheckoutVariant | null = null;
  let product: CheckoutProduct | null = null;
  let stripePriceId: string | null = null;

  if (variantId) {
    const variantResult = await supabase
      .from("product_variants")
      .select("id, product_id, variant_name, light_pattern, lens_color, harness_included, dielectric_grease_included, protective_film_included, stripe_price_id, active, inventory_status")
      .eq("id", variantId)
      .eq("active", true)
      .maybeSingle();
    variant = variantResult.data as CheckoutVariant | null;
    let error = variantResult.error;

    if (error?.code === "42703" || error?.code === "PGRST204") {
      const fallbackVariantResult = await supabase
        .from("product_variants")
        .select("id, product_id, variant_name, light_pattern, lens_color, harness_included, stripe_price_id, active, inventory_status")
        .eq("id", variantId)
        .eq("active", true)
        .maybeSingle();

      variant = fallbackVariantResult.data as CheckoutVariant | null;
      error = fallbackVariantResult.error;
    }

    if (error) {
      console.error("Product checkout variant lookup failed", error);
      return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
    }

    if (!variant?.stripe_price_id) {
      return NextResponse.json({ error: "This product option is not available for checkout." }, { status: 404 });
    }

    if (variant.inventory_status === "out_of_stock" || variant.inventory_status === "inactive") {
      return NextResponse.json({ error: "This product option is currently out of stock." }, { status: 409 });
    }

    const productResult = await supabase
      .from("products")
      .select("id, name, active, stripe_price_id, inventory_status")
      .eq("id", variant.product_id)
      .eq("active", true)
      .maybeSingle();
    product = productResult.data as CheckoutProduct | null;
    const productError = productResult.error;

    if (productError) {
      console.error("Product checkout parent product lookup failed", productError);
      return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
    }

    stripePriceId = variant.stripe_price_id;
  } else if (productId) {
    const productResult = await supabase
      .from("products")
      .select("id, name, active, stripe_price_id, inventory_status")
      .eq("id", productId)
      .eq("active", true)
      .maybeSingle();
    product = productResult.data as CheckoutProduct | null;
    const productError = productResult.error;

    if (productError) {
      console.error("Product checkout product lookup failed", productError);
      return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
    }

    if (product) {
      const { data: activeVariants, error: activeVariantError } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", product.id)
        .eq("active", true)
        .neq("inventory_status", "inactive")
        .limit(1);

      if (activeVariantError) {
        console.error("Product checkout active variant lookup failed", activeVariantError);
        return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
      }

      if (activeVariants?.length) {
        return NextResponse.json({ error: "Please choose a product option before checkout." }, { status: 400 });
      }
    }

    stripePriceId = product?.stripe_price_id ?? null;
  }

  if (!product) {
    return NextResponse.json({ error: "This product is not available for checkout." }, { status: 404 });
  }

  if (product.inventory_status === "out_of_stock" || product.inventory_status === "inactive") {
    return NextResponse.json({ error: "This product is currently out of stock." }, { status: 409 });
  }

  if (!stripePriceId) {
    return NextResponse.json({ error: "This product is missing Stripe pricing." }, { status: 409 });
  }

  if (buildId) {
    const { data: link, error: linkError } = await supabase
      .from("build_products")
      .select("id, verified_builds!inner(id, published)")
      .eq("build_id", buildId)
      .eq("product_id", product.id)
      .eq("verified_builds.published", true)
      .maybeSingle();

    if (linkError) {
      console.error("Product checkout build link lookup failed", linkError);
      return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
    }

    if (!link) {
      return NextResponse.json({ error: "This product is not linked to that build." }, { status: 404 });
    }
  }

  devLog("Resolved product checkout stripe_price_id:", stripePriceId);

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const greaseAddOnCents = variant ? getVariantAddOnPriceCents({
      dielectricGreaseIncluded: variant.dielectric_grease_included ?? null
    }) : 0;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: stripePriceId,
          quantity
        },
        ...(greaseAddOnCents ? [{
          price_data: {
            currency: "usd",
            unit_amount: greaseAddOnCents,
            product_data: {
              name: "Dielectric grease add-on",
              metadata: {
                product_id: product.id,
                variant_id: variant?.id ?? ""
              }
            }
          },
          quantity
        }] : [])
      ],
      success_url: `${siteUrl}/success?type=product&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: buildId ? `${siteUrl}/builds/${buildId}` : `${siteUrl}/parts`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"]
      },
      metadata: {
        product_id: product.id,
        variant_id: variant?.id ?? "",
        build_id: buildId ?? "",
        light_pattern: variant?.light_pattern ?? "",
        lens_color: variant?.lens_color ?? "",
        harness_included: variant?.harness_included ? "true" : "false",
        dielectric_grease_included: variant && "dielectric_grease_included" in variant && variant.dielectric_grease_included !== null ? variant.dielectric_grease_included ? "true" : "false" : "",
        protective_film_included: variant && "protective_film_included" in variant && variant.protective_film_included !== null ? variant.protective_film_included ? "true" : "false" : "",
        source: buildId ? "build_product_variant" : variant ? "parts_product_variant" : "parts_product"
      }
    });

    devLog("Product checkout session id:", session.id);

    return NextResponse.json({ url: session.url });
  } catch (checkoutError) {
    console.error("Product checkout session creation failed", checkoutError);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }
}
