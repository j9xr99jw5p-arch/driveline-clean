import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  freePlanKey,
  normalizeStripeCustomerId,
  normalizeSupabaseUserId,
  paidPlanKey,
  planFromSubscriptionStatus,
  saveStripeCustomerMapping,
  saveUsersTableStripeCustomerId,
  upsertUserPlanForSubscription
} from "@/lib/billing";
import { buildOrderItemRows, normalizeSelectedItems } from "@/lib/packCheckout";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

function devLog(message: string, details?: unknown) {
  if (process.env.NODE_ENV !== "production") console.log(message, details ?? "");
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
    console.log("Stripe webhook event type:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "payment") {
          await syncProductOrder(session, event);
          break;
        }

        const customerId = normalizeStripeCustomerId(session.customer);
        let subscription: Stripe.Subscription | null = null;

        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        }

        const userId = await resolveSupabaseUserId({
          session,
          subscription,
          customerId
        });

        console.log("Stripe webhook resolved supabase_user_id:", userId);

        if (userId && customerId) {
          await saveStripeCustomerMapping(supabase, userId, customerId, session.customer_details?.email ?? null);
          await saveUsersTableStripeCustomerId(supabase, userId, customerId);
        }

        if (subscription) await syncSubscription(subscription, userId);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") await syncProductOrder(session, event);
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

  async function resolveSupabaseUserId({
    session,
    subscription,
    customerId
  }: {
    session?: Stripe.Checkout.Session;
    subscription?: Stripe.Subscription | null;
    customerId?: string | null;
  }) {
    const metadataUserId =
      normalizeSupabaseUserId(session?.metadata?.supabase_user_id) ??
      normalizeSupabaseUserId(session?.metadata?.user_id) ??
      normalizeSupabaseUserId(session?.client_reference_id) ??
      normalizeSupabaseUserId(subscription?.metadata.supabase_user_id) ??
      normalizeSupabaseUserId(subscription?.metadata.user_id);

    if (metadataUserId) return metadataUserId;

    if (!customerId) return null;

    const { data: customer, error } = await supabase
      .from("stripe_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (error) console.error("Stripe customer user lookup failed", error);
    return normalizeSupabaseUserId(customer?.user_id);
  }

  async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
    const customerId = normalizeStripeCustomerId(subscription.customer);
    const userId = await resolveSupabaseUserId({
      subscription,
      customerId
    }) ?? normalizeSupabaseUserId(fallbackUserId);

    console.log("Stripe webhook resolved supabase_user_id:", userId);

    if (!userId || !customerId) {
      console.error("Stripe subscription sync skipped; missing user or customer", {
        subscriptionId: subscription.id,
        customerId,
        userId
      });
      return;
    }

    await saveStripeCustomerMapping(supabase, userId, customerId);
    await saveUsersTableStripeCustomerId(supabase, userId, customerId);

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
      plan: paidPlanKey,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
    }, { onConflict: "stripe_subscription_id" });

    const activePlan = planFromSubscriptionStatus(subscription.status);
    const planStatus = event.type === "customer.subscription.deleted" ? "inactive" : subscription.status;

    await upsertUserPlanForSubscription({
      supabase,
      userId,
      plan: activePlan === paidPlanKey ? paidPlanKey : freePlanKey,
      status: planStatus,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart,
      currentPeriodEnd
    });
  }

  async function syncProductOrder(session: Stripe.Checkout.Session, stripeEvent: Stripe.Event) {
    devLog("Stripe webhook payment mode:", session.mode);

    const isCustomPackCheckout = session.metadata?.checkout_type === "custom_pack";
    const productId = isCustomPackCheckout ? null : session.metadata?.product_id ?? null;
    const variantId = session.metadata?.variant_id ?? null;
    const buildId = session.metadata?.build_id || null;
    const paymentIntentId = normalizePaymentIntentId(session.payment_intent);
    const customerId = normalizeStripeCustomerId(session.customer);
    const shippingDetails = getSessionShippingDetails(session);
    const paidAt = session.payment_status === "paid"
      ? new Date(stripeEvent.created * 1000).toISOString()
      : null;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    const quantity = isCustomPackCheckout
      ? lineItems.data.reduce((total, item) => total + (item.quantity ?? 1), 0)
      : lineItems.data[0]?.quantity ?? 1;

    devLog("Stripe product purchase:", {
      productId,
      variantId,
      buildId,
      stripeCustomerId: customerId,
      stripePaymentIntentId: paymentIntentId,
      amountTotal: session.amount_total
    });

    const { data, error } = await supabase
      .from("orders")
      .upsert({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: customerId,
        product_id: productId,
        variant_id: variantId,
        build_id: buildId,
        quantity,
        amount_total: session.amount_total,
        currency: session.currency,
        status: session.payment_status,
        livemode: session.livemode,
        paid_at: paidAt,
        customer_email: session.customer_details?.email ?? null,
        shipping_name: shippingDetails?.name ?? null,
        shipping_address: shippingDetails?.address ?? null
      }, { onConflict: "stripe_checkout_session_id" })
      .select("id")
      .maybeSingle();

    devLog("Product order insert result:", { data, error });
    if (error) {
      console.error("Product order upsert failed", error);
      return;
    }

    if (isCustomPackCheckout && data?.id) {
      await syncCustomPackOrderItems({
        orderId: data.id,
        lineItems: lineItems.data,
        session
      });
    }
  }

  async function syncCustomPackOrderItems({
    orderId,
    lineItems,
    session
  }: {
    orderId: string;
    lineItems: Stripe.LineItem[];
    session: Stripe.Checkout.Session;
  }) {
    const selectionId = session.metadata?.selection_id ?? null;
    if (!selectionId) {
      console.error("Custom pack order item sync skipped; missing selection id", { sessionId: session.id });
      return;
    }

    const { data: selection, error: selectionError } = await supabase
      .from("starter_pack_checkout_selections")
      .select("items")
      .eq("id", selectionId)
      .maybeSingle();

    if (selectionError || !selection) {
      console.error("Custom pack selection lookup failed", { selectionId, error: selectionError });
      return;
    }

    const selectedItems = normalizeSelectedItems(selection.items);
    if (!selectedItems.length) {
      console.error("Custom pack order item sync skipped; selection has no items", { selectionId });
      return;
    }

    let orderItemRows;
    try {
      orderItemRows = buildOrderItemRows({
        orderId,
        sessionId: session.id,
        sessionCurrency: session.currency,
        selectedItems,
        stripeLineItems: lineItems
      });
    } catch (mappingError) {
      console.error("Custom pack order item mapping failed", mappingError);
      return;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .upsert(orderItemRows, { onConflict: "stripe_line_item_id" });

    if (itemError) console.error("Custom pack order items upsert failed", itemError);
  }
}

function normalizePaymentIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getSessionShippingDetails(session: Stripe.Checkout.Session) {
  return "shipping_details" in session ? session.shipping_details : null;
}
