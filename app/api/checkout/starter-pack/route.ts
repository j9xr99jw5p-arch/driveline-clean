import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildStarterPackCheckoutPlan,
  PackCheckoutValidationError,
  type PackCheckoutRow
} from "@/lib/packCheckout";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const checkoutItemSchema = z.object({
  productId: z.string().uuid().optional(),
  part_id: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(10)
}).transform((item) => ({
  productId: item.productId ?? item.part_id,
  variantId: item.variantId ?? item.variant_id ?? null,
  quantity: item.quantity
})).refine((item) => Boolean(item.productId), {
  message: "Each selected item needs a product id."
});

const schema = z.object({
  packSlug: z.string().trim().min(1).max(100).optional(),
  pack_slug: z.string().trim().min(1).max(100).optional(),
  items: z.array(checkoutItemSchema).min(1).max(25)
}).transform((payload) => ({
  packSlug: payload.packSlug ?? payload.pack_slug,
  items: payload.items.map((item) => ({
    productId: item.productId!,
    variantId: item.variantId,
    quantity: item.quantity
  }))
})).refine((payload) => Boolean(payload.packSlug), {
  message: "Choose a valid starter pack."
});

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. Please try again in a moment.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose at least one valid starter pack item." }, { status: 400 });
  }

  const packSlug = parsed.data.packSlug!;
  const supabase = createSupabaseAdminClient();
  const { data: packData, error } = await supabase
    .from("packs")
    .select(`
      id,
      slug,
      pack_products (
        product_id,
        products (
          id,
          name,
          category,
          description,
          image_url,
          price_cents,
          stripe_price_id,
          active,
          inventory_status,
          product_variants (
            id,
            product_id,
            variant_name,
            stripe_price_id,
            active,
            inventory_status,
            price_cents
          )
        )
      )
    `)
    .eq("active", true)
    .eq("slug", packSlug)
    .maybeSingle();

  if (error) {
    console.error("Starter pack checkout pack lookup failed", error);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }

  if (!packData) {
    return NextResponse.json({ error: "This starter pack is no longer available." }, { status: 404 });
  }

  const pack = packData as PackCheckoutRow;
  let checkoutPlan: ReturnType<typeof buildStarterPackCheckoutPlan>;
  try {
    checkoutPlan = buildStarterPackCheckoutPlan(pack, parsed.data.items);
  } catch (validationError) {
    if (validationError instanceof PackCheckoutValidationError) {
      return NextResponse.json({ error: validationError.message }, { status: validationError.status });
    }
    throw validationError;
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const selectionId = crypto.randomUUID();

    const { error: selectionError } = await supabase
      .from("starter_pack_checkout_selections")
      .insert({
        id: selectionId,
        pack_id: pack.id,
        pack_slug: pack.slug,
        items: checkoutPlan.selectionItems
      });

    if (selectionError) {
      console.error("Starter pack checkout selection save failed", selectionError);
      return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: checkoutPlan.lineItems,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/parts/packs/${encodeURIComponent(packSlug)}`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"]
      },
      metadata: {
        checkout_type: "custom_pack",
        source: "starter_pack",
        selection_id: selectionId,
        pack_id: pack.id,
        pack_slug: pack.slug
      }
    });

    const { error: sessionUpdateError } = await supabase
      .from("starter_pack_checkout_selections")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", selectionId);

    if (sessionUpdateError) {
      console.error("Starter pack checkout selection session update failed", sessionUpdateError);
      return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (checkoutError) {
    console.error("Starter pack checkout session creation failed", checkoutError);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }
}
