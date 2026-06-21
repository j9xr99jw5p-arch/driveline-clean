import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const schema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).optional(),
  buildId: z.string().uuid().optional()
});

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

function devLog(message: string, details?: unknown) {
  if (process.env.NODE_ENV !== "production") console.log(message, details ?? "");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please choose a valid product." }, { status: 400 });
  }

  const { variantId, buildId } = parsed.data;
  const quantity = parsed.data.quantity ?? 1;

  devLog("Product checkout variantId:", variantId);

  const supabase = createSupabaseAdminClient();
  const { data: variant, error } = await supabase
    .from("product_variants")
    .select("id, product_id, variant_name, light_pattern, lens_color, harness_included, stripe_price_id, active")
    .eq("id", variantId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("Product checkout variant lookup failed", error);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }

  if (!variant?.stripe_price_id) {
    return NextResponse.json({ error: "This product option is not available for checkout." }, { status: 404 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, active")
    .eq("id", variant.product_id)
    .eq("active", true)
    .maybeSingle();

  if (productError) {
    console.error("Product checkout parent product lookup failed", productError);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ error: "This product is not available for checkout." }, { status: 404 });
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

  devLog("Resolved variant stripe_price_id:", variant.stripe_price_id);

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: variant.stripe_price_id,
          quantity
        }
      ],
      success_url: `${siteUrl}/success?type=product&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: buildId ? `${siteUrl}/builds/${buildId}` : `${siteUrl}/parts`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"]
      },
      metadata: {
        product_id: product.id,
        variant_id: variant.id,
        build_id: buildId ?? "",
        light_pattern: variant.light_pattern ?? "",
        lens_color: variant.lens_color ?? "",
        harness_included: variant.harness_included ? "true" : "false",
        source: buildId ? "build_product_variant" : "parts_product_variant"
      }
    });

    devLog("Product checkout session id:", session.id);

    return NextResponse.json({ url: session.url });
  } catch (checkoutError) {
    console.error("Product checkout session creation failed", checkoutError);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }
}
