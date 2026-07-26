import { NextResponse } from "next/server";
import { findOrCreateStripeCustomerForUser } from "@/lib/billing";
import { currentVerifiedBuildAccessLabel } from "@/lib/fitmentCreditSecurity";
import { fitmentTwoChecksCreditQuantity, fitmentTwoChecksEntitlementKey } from "@/lib/fitmentEntitlements";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const checkoutErrorMessage =
  "We’re having trouble opening checkout right now. Please try again in a moment.";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) {
    return NextResponse.json(
      {
        error: "Please sign in before purchasing premium checks.",
        redirectUrl: "/account?auth=required"
      },
      { status: 401 }
    );
  }

  const price = process.env.STRIPE_FITMENT_TWO_CHECKS_PRICE_ID;
  if (!price) {
    console.error("Missing STRIPE_FITMENT_TWO_CHECKS_PRICE_ID");
    return NextResponse.json({ error: checkoutErrorMessage }, { status: 500 });
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
      entitlement_key: fitmentTwoChecksEntitlementKey,
      premium_checks: String(fitmentTwoChecksCreditQuantity),
      premium_build_access_policy: currentVerifiedBuildAccessLabel
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: currentUser.userId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/success?purchase=fitment-credits&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel?purchase=fitment-credits`,
      metadata,
      payment_intent_data: { metadata }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Fitment credits checkout session creation failed", error);
    return NextResponse.json({ error: checkoutErrorMessage }, { status: 500 });
  }
}
