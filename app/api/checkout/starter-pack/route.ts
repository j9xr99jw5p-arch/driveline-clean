import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const schema = z.object({
  pack_slug: z.string().trim().min(1).max(100),
  items: z.array(z.object({
    part_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(10)
  })).min(1).max(25)
});

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. Please try again in a moment.";

type ProductCheckoutRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  stripe_price_id: string | null;
  active: boolean;
  inventory_status?: string | null;
};

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose at least one valid starter pack item." }, { status: 400 });
  }

  const { pack_slug: packSlug } = parsed.data;
  const quantitiesByPartId = parsed.data.items.reduce<Map<string, number>>((map, item) => {
    map.set(item.part_id, (map.get(item.part_id) ?? 0) + item.quantity);
    return map;
  }, new Map());
  const partIds = Array.from(quantitiesByPartId.keys());

  const supabase = createSupabaseAdminClient();
  const initialResult = await supabase
    .from("products")
    .select("id, name, category, description, image_url, price_cents, stripe_price_id, active, inventory_status")
    .in("id", partIds);
  let products = initialResult.data as ProductCheckoutRow[] | null;
  let error = initialResult.error;

  if (error?.code === "42703" || error?.code === "PGRST204") {
    const fallback = await supabase
      .from("products")
      .select("id, name, category, description, image_url, price_cents, stripe_price_id, active")
      .in("id", partIds);
    products = fallback.data as ProductCheckoutRow[] | null;
    error = fallback.error;
  }

  if (error) {
    console.error("Starter pack checkout product lookup failed", error);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }

  const productRows = (products ?? []) as ProductCheckoutRow[];
  if (productRows.length !== partIds.length) {
    return NextResponse.json({ error: "One or more selected parts are no longer available." }, { status: 404 });
  }

  const inactiveProduct = productRows.find((product) => !product.active || product.inventory_status === "inactive");
  if (inactiveProduct) {
    return NextResponse.json({ error: `${inactiveProduct.name} is not available for checkout.` }, { status: 409 });
  }

  const outOfStockProduct = productRows.find((product) => product.inventory_status === "out_of_stock");
  if (outOfStockProduct) {
    return NextResponse.json({ error: `${outOfStockProduct.name} is currently out of stock.` }, { status: 409 });
  }

  const unpricedProduct = productRows.find((product) => !product.stripe_price_id && !isPositiveCents(product.price_cents));
  if (unpricedProduct) {
    return NextResponse.json({ error: `${unpricedProduct.name} needs a price before checkout.` }, { status: 409 });
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const lineItems = productRows.map((product) => {
      const quantity = quantitiesByPartId.get(product.id) ?? 1;
      const adjustableQuantity = {
        enabled: true,
        minimum: 1,
        maximum: 10
      };

      if (product.stripe_price_id) {
        return {
          price: product.stripe_price_id,
          quantity,
          adjustable_quantity: adjustableQuantity
        };
      }

      return {
        price_data: {
          currency: "usd",
          unit_amount: product.price_cents!,
          product_data: {
            name: product.name,
            description: product.description ?? undefined,
            images: isPublicImageUrl(product.image_url) ? [product.image_url] : undefined,
            metadata: {
              product_id: product.id,
              pack_slug: packSlug,
              category: product.category
            }
          }
        },
        quantity,
        adjustable_quantity: adjustableQuantity
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/parts/packs/${encodeURIComponent(packSlug)}`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"]
      },
      metadata: {
        source: "starter_pack",
        pack_slug: packSlug,
        selected_product_ids: partIds.join(",")
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (checkoutError) {
    console.error("Starter pack checkout session creation failed", checkoutError);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }
}

function isPositiveCents(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPublicImageUrl(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith("https://") || value?.startsWith("http://"));
}
