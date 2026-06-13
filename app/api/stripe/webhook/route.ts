import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { planLimits } from "@/lib/plans";
import { isSupabaseAuthUserId } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

function stripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function metadataUserId(value: string | null | undefined): string | null {
  return isSupabaseAuthUserId(value) ? value : null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  const stripe = getStripe();
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = metadataUserId(session.client_reference_id) ?? metadataUserId(session.metadata?.user_id);
        const customerId = stripeCustomerId(session.customer);

        if (userId && customerId) {
          await saveStripeCustomerMapping(userId, customerId);
        }

        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook processing failed", event.type, error);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });

  async function saveStripeCustomerMapping(userId: string, customerId: string) {
    const { error: customerError } = await supabase.from("stripe_customers").upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: "user_id" }
    );
    if (customerError) console.error("Stripe customer mapping upsert failed", customerError);

    const { error: usersError } = await supabase
      .from("users")
      .upsert({ id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (usersError) console.error("Optional users.stripe_customer_id save failed", usersError);
  }

  async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
    const customerId = stripeCustomerId(subscription.customer);
    let userId = metadataUserId(subscription.metadata.user_id) ?? metadataUserId(fallbackUserId);

    if (!userId && customerId) {
      const { data: customer } = await supabase
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = metadataUserId(customer?.user_id);
    }

    const rawPlan = subscription.metadata.plan;
    const plan = rawPlan === "builder" ? "builder" : "free";
    const activePlan = subscription.status === "active" || subscription.status === "trialing" ? plan : "free";

    if (!userId || !customerId) {
      console.error("Stripe subscription sync skipped; missing user or customer", {
        subscriptionId: subscription.id,
        customerId,
        userId
      });
      return;
    }

    await saveStripeCustomerMapping(userId, customerId);

    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: subscription.status,
      plan,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
    }, { onConflict: "stripe_subscription_id" });

    await supabase.from("user_plans").upsert({
      user_id: userId,
      plan: activePlan,
      status: subscription.status,
      fitment_check_limit: planLimits[activePlan].fitment_check_limit,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd
    }, { onConflict: "user_id" });
  }
}
