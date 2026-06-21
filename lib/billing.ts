import "server-only";
import type Stripe from "stripe";
import { planLimits } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAuthUserId } from "@/lib/supabase/auth";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export const paidPlanKey = "paid";
export const builderPlanKey = "builder";
export const freePlanKey = "free";

const activeStatuses = new Set(["active", "trialing"]);
const unpaidStatuses = new Set(["canceled", "incomplete", "incomplete_expired", "past_due", "unpaid"]);

export function normalizeStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export function normalizeSupabaseUserId(value: string | null | undefined): string | null {
  return isSupabaseAuthUserId(value) ? value : null;
}

export function isPaidPlanActive(plan: string | null | undefined, status: string | null | undefined) {
  return (plan === paidPlanKey || plan === builderPlanKey) && Boolean(status && activeStatuses.has(status));
}

export function planFromSubscriptionStatus(status: string | null | undefined) {
  return status && activeStatuses.has(status) ? paidPlanKey : freePlanKey;
}

export function accessStatusFromSubscriptionStatus(status: string | null | undefined) {
  if (!status) return "active";
  return activeStatuses.has(status) ? status : "inactive";
}

export function isUnpaidSubscriptionStatus(status: string | null | undefined) {
  return Boolean(status && unpaidStatuses.has(status));
}

export async function findMappedStripeCustomerId(
  supabase: SupabaseAdminClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) console.error("Stripe customer lookup failed", error);
  return data?.stripe_customer_id as string | undefined;
}

export async function findStripeCustomerByEmailMapping(
  supabase: SupabaseAdminClient,
  email: string
) {
  const { data, error } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id, user_id, email")
    .eq("email", email)
    .maybeSingle();

  if (error) console.error("Stripe customer email lookup failed", error);
  return data;
}

export async function saveStripeCustomerMapping(
  supabase: SupabaseAdminClient,
  userId: string,
  customerId: string,
  email?: string | null
) {
  const row = {
    user_id: userId,
    stripe_customer_id: customerId,
    ...(email ? { email: email.toLowerCase() } : {})
  };

  const { error } = await supabase.from("stripe_customers").upsert(row, { onConflict: "user_id" });
  if (!error) return;

  if (isMissingColumnError(error) && "email" in row) {
    const { error: retryError } = await supabase
      .from("stripe_customers")
      .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
    if (retryError) console.error("Stripe customer mapping upsert failed", retryError);
    return;
  }

  console.error("Stripe customer mapping upsert failed", error);
}

export async function saveUsersTableStripeCustomerId(
  supabase: SupabaseAdminClient,
  userId: string,
  customerId: string
) {
  const { error } = await supabase
    .from("users")
    .upsert({ id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) console.error("Optional users.stripe_customer_id save failed", error);
}

export async function getUsersTableStripeCustomerId(
  supabase: SupabaseAdminClient,
  userId: string
) {
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

export async function findOrCreateStripeCustomerForUser({
  stripe,
  supabase,
  userId,
  email
}: {
  stripe: Stripe;
  supabase: SupabaseAdminClient;
  userId: string;
  email: string;
}) {
  const normalizedEmail = email.toLowerCase();
  const mappedCustomerId = await findMappedStripeCustomerId(supabase, userId);
  if (mappedCustomerId) return mappedCustomerId;

  const usersTableCustomerId = await getUsersTableStripeCustomerId(supabase, userId);
  if (usersTableCustomerId) {
    await saveStripeCustomerMapping(supabase, userId, usersTableCustomerId, normalizedEmail);
    return usersTableCustomerId;
  }

  const emailMappedCustomer = await findStripeCustomerByEmailMapping(supabase, normalizedEmail);
  if (emailMappedCustomer?.stripe_customer_id) {
    await saveStripeCustomerMapping(supabase, userId, emailMappedCustomer.stripe_customer_id, normalizedEmail);
    await saveUsersTableStripeCustomerId(supabase, userId, emailMappedCustomer.stripe_customer_id);
    return emailMappedCustomer.stripe_customer_id as string;
  }

  const matchingCustomers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
  const customer = matchingCustomers.data[0] ?? await stripe.customers.create({
    email: normalizedEmail,
    metadata: { supabase_user_id: userId }
  });

  if (customer.metadata?.supabase_user_id !== userId) {
    await stripe.customers.update(customer.id, {
      metadata: { ...customer.metadata, supabase_user_id: userId }
    });
  }

  await saveStripeCustomerMapping(supabase, userId, customer.id, normalizedEmail);
  await saveUsersTableStripeCustomerId(supabase, userId, customer.id);

  return customer.id;
}

export async function ensureFreeUserPlan(supabase: SupabaseAdminClient, userId: string) {
  const { data, error } = await supabase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("User plan lookup failed", error);
    return null;
  }

  if (data) return data;

  const row = {
    user_id: userId,
    plan: freePlanKey,
    status: "active",
    fitment_check_limit: planLimits.free.fitment_check_limit,
    fitment_checks_used: 0
  };

  const { data: inserted, error: insertError } = await supabase
    .from("user_plans")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();

  if (insertError) {
    console.error("Default free user plan upsert failed", insertError);
    return null;
  }

  return inserted;
}

export async function repairBillingLinksForUser({
  supabase,
  userId,
  email
}: {
  supabase: SupabaseAdminClient;
  userId: string;
  email: string | null | undefined;
}) {
  const normalizedEmail = email?.toLowerCase() ?? null;
  await ensureFreeUserPlan(supabase, userId);

  let stripeCustomer = null;
  if (normalizedEmail) {
    stripeCustomer = await findStripeCustomerByEmailMapping(supabase, normalizedEmail);
    if (stripeCustomer?.stripe_customer_id && !stripeCustomer.user_id) {
      await saveStripeCustomerMapping(supabase, userId, stripeCustomer.stripe_customer_id as string, normalizedEmail);
    }
  }

  const mappedCustomerId = await findMappedStripeCustomerId(supabase, userId);
  if (!mappedCustomerId && normalizedEmail && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const matchingCustomers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
      const customer = matchingCustomers.data[0];
      if (customer) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, supabase_user_id: userId }
        });
        await saveStripeCustomerMapping(supabase, userId, customer.id, normalizedEmail);
        await saveUsersTableStripeCustomerId(supabase, userId, customer.id);
      }
    } catch (error) {
      console.error("Stripe customer email backfill failed", error);
    }
  }
}

export async function upsertUserPlanForSubscription({
  supabase,
  userId,
  plan,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodStart,
  currentPeriodEnd
}: {
  supabase: SupabaseAdminClient;
  userId: string;
  plan: string;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const row = {
    user_id: userId,
    plan,
    status,
    fitment_check_limit: planLimits[plan === paidPlanKey ? paidPlanKey : freePlanKey].fitment_check_limit,
    current_period_start: currentPeriodStart ?? null,
    current_period_end: currentPeriodEnd ?? null,
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {})
  };

  const { error } = await supabase.from("user_plans").upsert(row, { onConflict: "user_id" });
  if (!error) return;

  if (isMissingColumnError(error)) {
    const { error: retryError } = await supabase.from("user_plans").upsert({
      user_id: userId,
      plan,
      status,
      fitment_check_limit: planLimits[plan === paidPlanKey ? paidPlanKey : freePlanKey].fitment_check_limit,
      current_period_start: currentPeriodStart ?? null,
      current_period_end: currentPeriodEnd ?? null
    }, { onConflict: "user_id" });
    if (retryError) console.error("User plan upsert failed", retryError);
    return;
  }

  if (isPlanValueError(error) && plan === paidPlanKey) {
    await upsertUserPlanForSubscription({
      supabase,
      userId,
      plan: builderPlanKey,
      status,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodStart,
      currentPeriodEnd
    });
    return;
  }

  console.error("User plan upsert failed", error);
}

function isMissingColumnError(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || /column .* does not exist/i.test(error.message ?? "");
}

function isPlanValueError(error: { code?: string; message?: string }) {
  return error.code === "22P02" || /invalid input value for enum/i.test(error.message ?? "");
}
