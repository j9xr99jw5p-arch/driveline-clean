import { NextResponse } from "next/server";
import { findOrCreateStripeCustomerForUser } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const friendlyPortalError =
  "We’re having trouble opening billing right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) return NextResponse.json({ error: "Please sign in to manage billing." }, { status: 401 });

  try {
    const stripe = getStripe();
    const admin = createSupabaseAdminClient();
    const customerId = await findOrCreateStripeCustomerForUser({
      stripe,
      supabase: admin,
      userId: currentUser.userId,
      email: currentUser.user.email ?? ""
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/account`
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Stripe billing portal creation failed", error);
    return NextResponse.json({ error: friendlyPortalError }, { status: 500 });
  }
}
