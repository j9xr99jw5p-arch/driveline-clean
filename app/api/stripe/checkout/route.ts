import { NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateStripeCustomerForUser, paidPlanKey } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  plan: z.literal("builder"),
  email: z.string().trim().email().max(254).optional().or(z.literal(""))
});

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const price = process.env.STRIPE_BUILDER_PLUS_PRICE_ID;
  if (!price) {
    console.error("Missing STRIPE_BUILDER_PLUS_PRICE_ID");
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }

  let currentUser: Awaited<ReturnType<typeof getCurrentSupabaseUser>> = null;
  try {
    const supabase = await createSupabaseServerClient();
    currentUser = await getCurrentSupabaseUser(supabase);
  } catch (error) {
    console.error("Checkout user lookup failed", error);
  }

  if (!currentUser) {
    return NextResponse.json(
      {
        error: "Please sign in before upgrading.",
        redirectUrl: "/account?auth=required"
      },
      { status: 401 }
    );
  }

  const checkoutEmail = currentUser.user.email?.toLowerCase() ?? parsed.data.email?.toLowerCase();
  if (!checkoutEmail) {
    return NextResponse.json({ error: "Your account needs an email address before checkout can start." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  const metadata: Record<string, string> = {
    supabase_user_id: currentUser.userId,
    user_id: currentUser.userId,
    plan: paidPlanKey,
    email: checkoutEmail
  };

  console.log("Stripe checkout user id:", currentUser.userId);
  const customerId = await findOrCreateStripeCustomerForUser({
    stripe,
    supabase: admin,
    userId: currentUser.userId,
    email: checkoutEmail
  });
  console.log("Stripe checkout customer id:", customerId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_update: { name: "auto", address: "auto" },
      allow_promotion_codes: true,
      client_reference_id: currentUser.userId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel`,
      metadata,
      subscription_data: { metadata }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session creation failed", error);
    return NextResponse.json({ error: friendlyCheckoutError }, { status: 500 });
  }
}
