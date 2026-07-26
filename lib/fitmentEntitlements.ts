import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaidPlanActive } from "@/lib/billing";
import { currentVerifiedBuildAccessLabel } from "@/lib/fitmentCreditSecurity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export const fitmentTwoChecksEntitlementKey = "fitment_two_checks";
export const fitmentTwoChecksCreditQuantity = 2;

type EntitlementAccountRow = {
  user_id: string;
  premium_checks_remaining: number;
  premium_build_access: boolean;
};

type UserPlanRow = {
  plan: string | null;
  status: string | null;
};

export type FitmentEntitlement = {
  isAuthenticated: boolean;
  userId: string | null;
  premiumChecksRemaining: number;
  premiumBuildAccess: boolean;
  canRunPremiumCheck: boolean;
  canViewPremiumBuilds: boolean;
};

export function emptyFitmentEntitlement(): FitmentEntitlement {
  return {
    isAuthenticated: false,
    userId: null,
    premiumChecksRemaining: 0,
    premiumBuildAccess: false,
    canRunPremiumCheck: false,
    canViewPremiumBuilds: false
  };
}

export async function getFitmentEntitlementForCurrentUser(): Promise<FitmentEntitlement> {
  if (!hasSupabaseServerEnv()) return emptyFitmentEntitlement();

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) return emptyFitmentEntitlement();

  return getFitmentEntitlementForUser(currentUser.userId);
}

export async function getFitmentEntitlementForUser(userId: string): Promise<FitmentEntitlement> {
  const admin = createSupabaseAdminClient();

  const [{ data: account }, { data: plan }] = await Promise.all([
    admin
      .from("fitment_credit_accounts")
      .select("user_id, premium_checks_remaining, premium_build_access")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("user_plans")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  return normalizeFitmentEntitlement({
    userId,
    account: account as EntitlementAccountRow | null,
    plan: plan as UserPlanRow | null
  });
}

export async function grantFitmentPurchaseEntitlement({
  supabase,
  userId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  metadata
}: {
  supabase: SupabaseClient;
  userId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc("grant_fitment_credits", {
    p_user_id: userId,
    p_credit_delta: fitmentTwoChecksCreditQuantity,
    p_premium_build_access: true,
    p_transaction_type: "stripe_purchase",
    p_stripe_checkout_session_id: stripeCheckoutSessionId,
    p_stripe_payment_intent_id: stripePaymentIntentId,
    p_metadata: {
      entitlement_key: fitmentTwoChecksEntitlementKey,
      premium_build_access_policy: currentVerifiedBuildAccessLabel,
      ...(metadata ?? {})
    }
  });

  if (error) throw error;
  return data as EntitlementAccountRow | null;
}

export async function consumePremiumFitmentCredit({
  supabase,
  userId,
  fitmentCheckId,
  requestId,
  metadata
}: {
  supabase: SupabaseClient;
  userId: string;
  fitmentCheckId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc("consume_premium_fitment_credit", {
    p_user_id: userId,
    p_fitment_check_id: fitmentCheckId ?? null,
    p_request_id: requestId ?? null,
    p_metadata: metadata ?? {}
  });

  if (error) throw error;
  return data as EntitlementAccountRow | null;
}

function normalizeFitmentEntitlement({
  userId,
  account,
  plan
}: {
  userId: string;
  account: EntitlementAccountRow | null;
  plan: UserPlanRow | null;
}): FitmentEntitlement {
  const legacyPaidAccess = isPaidPlanActive(plan?.plan, plan?.status);
  const premiumChecksRemaining = Math.max(0, account?.premium_checks_remaining ?? 0);
  const premiumBuildAccess = Boolean(account?.premium_build_access || legacyPaidAccess);

  return {
    isAuthenticated: true,
    userId,
    premiumChecksRemaining,
    premiumBuildAccess,
    canRunPremiumCheck: premiumChecksRemaining > 0 || legacyPaidAccess,
    canViewPremiumBuilds: premiumBuildAccess
  };
}
