import { NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateStripeCustomerForUser } from "@/lib/billing";
import {
  getCreditPack,
  getCreditPackPriceId,
  isCreditPackKey
} from "@/lib/creditPacks";
import { currentVerifiedBuildAccessLabel } from "@/lib/fitmentCreditSecurity";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const checkoutErrorMessage =
  "We’re having trouble opening checkout right now. Please try again in a moment.";

const schema = z.object({
  pack: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const requestedPack = parsed.success ? parsed.data.pack : undefined;
  const pack = getCreditPack(isCreditPackKey(requestedPack) ? requestedPack : "credits_150");
  const price = getCreditPackPriceId(pack);

  if (!price) {
    console.error("Missing Stripe price for credit pack", pack.key);
    return NextResponse.json({ error: checkoutErrorMessage }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) {
    return NextResponse.json(
      {
        error: "Please sign in before purchasing credits.",
        redirectUrl: "/account?auth=required"
      },
      { status: 401 }
    );
  }

  const email = currentUser.user.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Your account needs an email address before checkout can start." }, { status: 400 });
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const admin = createSupabaseAdminClient();
    const customerId = await findOrCreateStripeCustomerForUser({
      stripe,
      supabase: admin,
      userId: currentUser.userId,
      email
    });

    const metadata = {
      supabase_user_id: currentUser.userId,
      user_id: currentUser.userId,
      entitlement_key: pack.entitlementKey,
      pack_key: pack.key,
      credits: String(pack.credits),
      premium_build_access_policy: currentVerifiedBuildAccessLabel
    };

    const session = pack.mode === "subscription"
      ? await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: currentUser.userId,
        line_items: [{ price, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${siteUrl}/success?purchase=fitment-credits&pack=${pack.key}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/cancel?purchase=fitment-credits`,
        metadata,
        subscription_data: { metadata }
      })
      : await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        client_reference_id: currentUser.userId,
        line_items: [{ price, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${siteUrl}/success?purchase=fitment-credits&pack=${pack.key}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/cancel?purchase=fitment-credits`,
        metadata,
        payment_intent_data: { metadata }
      });

    return NextResponse.json({ url: session.url, pack: pack.key, credits: pack.credits });
  } catch (error) {
    console.error("Credit pack checkout session creation failed", error);
    return NextResponse.json({ error: checkoutErrorMessage }, { status: 500 });
  }
}
