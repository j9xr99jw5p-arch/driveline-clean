import { NextResponse } from "next/server";
import type Stripe from "stripe";
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
    const customerId = await findOrCreateStripeCustomer(
      stripe,
      admin,
      currentUser.userId,
      currentUser.user.email ?? undefined
    );

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

async function findOrCreateStripeCustomer(
  stripe: Stripe,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  email?: string
) {
  const customerFromMapping = await getMappedStripeCustomerId(supabase, userId);
  if (customerFromMapping) return customerFromMapping;

  const customerFromUsersTable = await getUsersTableStripeCustomerId(supabase, userId);
  if (customerFromUsersTable) {
    await saveStripeCustomerMapping(supabase, userId, customerFromUsersTable);
    return customerFromUsersTable;
  }

  const matchingCustomers = email ? await stripe.customers.list({ email, limit: 1 }) : null;
  const customer = matchingCustomers?.data[0] ?? await stripe.customers.create({
    ...(email ? { email } : {}),
    metadata: { user_id: userId }
  });

  await saveStripeCustomerMapping(supabase, userId, customer.id);
  await saveUsersTableStripeCustomerId(supabase, userId, customer.id);

  return customer.id;
}

async function getMappedStripeCustomerId(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) console.error("Stripe customer lookup failed", error);
  return data?.stripe_customer_id as string | undefined;
}

async function getUsersTableStripeCustomerId(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Optional users.stripe_customer_id lookup failed", error);
    return undefined;
  }

  return data?.stripe_customer_id as string | undefined;
}

async function saveStripeCustomerMapping(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, customerId: string) {
  const { error } = await supabase.from("stripe_customers").upsert(
    { user_id: userId, stripe_customer_id: customerId },
    { onConflict: "user_id" }
  );

  if (error) console.error("Stripe customer mapping upsert failed", error);
}

async function saveUsersTableStripeCustomerId(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, customerId: string) {
  const { error } = await supabase
    .from("users")
    .upsert({ id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) console.error("Optional users.stripe_customer_id save failed", error);
}
