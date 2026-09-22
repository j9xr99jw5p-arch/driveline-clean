import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_STARTING_CREDITS } from "@/lib/creditPacks";

export async function ensureStartingCredits(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("ensure_starting_credits", {
    p_user_id: userId,
    p_amount: FREE_STARTING_CREDITS
  });

  if (error) {
    console.error("ensure_starting_credits failed", error);
    return null;
  }

  return typeof data === "number" ? data : null;
}

export async function grantSpendableCredits({
  supabase,
  userId,
  amount,
  type,
  priority = false,
  stripeCheckoutSessionId = null,
  stripeInvoiceId = null,
  metadata = {}
}: {
  supabase: SupabaseClient;
  userId: string;
  amount: number;
  type: "purchase" | "subscription" | "admin_grant";
  priority?: boolean;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc("grant_spendable_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_priority: priority,
    p_stripe_checkout_session_id: stripeCheckoutSessionId,
    p_stripe_invoice_id: stripeInvoiceId,
    p_metadata: metadata
  });

  if (error) throw error;
  return typeof data === "number" ? data : null;
}

export async function setCreditPriority(supabase: SupabaseClient, userId: string, priority: boolean) {
  const { error } = await supabase.rpc("set_credit_priority", {
    p_user_id: userId,
    p_priority: priority
  });

  if (error) console.error("set_credit_priority failed", error);
}

export async function getSpendableCreditBalance(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("credit_balances")
    .select("balance, priority")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Reading credit_balances failed", error);
    return { balance: 0, priority: false };
  }

  return {
    balance: typeof data?.balance === "number" ? data.balance : 0,
    priority: data?.priority === true
  };
}

export async function createModRequest(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("mod_requests").insert({}).select("id").maybeSingle();
  if (error) {
    console.error("Creating mod_request failed", error);
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

export async function reserveSpendableCredits({
  supabase,
  userId,
  amount,
  modRequestId = null
}: {
  supabase: SupabaseClient;
  userId: string;
  amount: number;
  modRequestId?: string | null;
}) {
  const { data, error } = await supabase.rpc("reserve_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_mod_request_id: modRequestId
  });

  if (error) throw error;

  if (data !== true) {
    const available = await getSpendableCreditBalance(supabase, userId);
    return { ok: false as const, available: available.balance };
  }

  return { ok: true as const, available: null };
}

export async function refundSpendableCredits({
  supabase,
  userId,
  amount,
  modRequestId = null
}: {
  supabase: SupabaseClient;
  userId: string;
  amount: number;
  modRequestId?: string | null;
}) {
  const { error } = await supabase.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_mod_request_id: modRequestId
  });

  if (error) console.error("refund_credits failed", error);
}

export function isUniqueCreditGrantViolation(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "23505" || /credit_transactions_(checkout_session|invoice)_key/i.test(message);
}
