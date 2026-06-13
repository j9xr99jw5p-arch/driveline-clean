import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
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

  const submittedEmail = parsed.data.email ? parsed.data.email.toLowerCase() : null;
  const checkoutEmail = currentUser?.user.email?.toLowerCase() ?? submittedEmail;
  if (!checkoutEmail) {
    return NextResponse.json({ error: "Please enter an email address to continue." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  const metadata: Record<string, string> = {
    plan: parsed.data.plan,
    email: checkoutEmail
  };

  let customerId: string | null = null;
  if (currentUser) {
    metadata.user_id = currentUser.userId;
    customerId = await findOrCreateStripeCustomer(stripe, admin, currentUser.userId, checkoutEmail);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(customerId ? { customer: customerId } : { customer_email: checkoutEmail }),
      ...(customerId ? { customer_update: { name: "auto", address: "auto" } } : {}),
      allow_promotion_codes: true,
      client_reference_id: currentUser?.userId,
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

async function findOrCreateStripeCustomer(
  stripe: Stripe,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  email: string
) {
  const customerFromMapping = await getMappedStripeCustomerId(supabase, userId);
  if (customerFromMapping) return customerFromMapping;

  const customerFromUsersTable = await getUsersTableStripeCustomerId(supabase, userId);
  if (customerFromUsersTable) {
    await saveStripeCustomerMapping(supabase, userId, customerFromUsersTable);
    return customerFromUsersTable;
  }

  const matchingCustomers = await stripe.customers.list({ email, limit: 1 });
  const customer = matchingCustomers.data[0] ?? await stripe.customers.create({
    email,
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
