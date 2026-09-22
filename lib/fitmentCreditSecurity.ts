export const currentVerifiedBuildAccessLabel = "Included access";
export const currentVerifiedBuildAccessDescription =
  "Verified Builds access is included with any credit pack or Priority subscription.";

export type FitmentCreditLineItem = {
  price?: { id?: string | null } | null;
  quantity?: number | null;
};

export type FitmentCreditSessionLike = {
  id: string;
  mode: string | null;
  payment_status: string | null;
  metadata?: Record<string, string | undefined> | null;
  client_reference_id?: string | null;
};

export type FitmentCreditFulfillmentCheck =
  | { ok: true; userId: string; priceId: string }
  | { ok: false; reason: "wrong_mode" | "unpaid" | "wrong_entitlement" | "missing_user" | "wrong_price" | "wrong_quantity" | "missing_price_config" };

export function validateFitmentCreditFulfillment({
  session,
  lineItems,
  expectedPriceId,
  allowedPriceIds,
  entitlementKey,
  allowedEntitlementKeys,
  normalizeUserId
}: {
  session: FitmentCreditSessionLike;
  lineItems: FitmentCreditLineItem[];
  expectedPriceId?: string;
  allowedPriceIds?: string[];
  entitlementKey?: string;
  allowedEntitlementKeys?: string[];
  normalizeUserId: (value: string | null | undefined) => string | null;
}): FitmentCreditFulfillmentCheck {
  if (session.mode !== "payment") return { ok: false, reason: "wrong_mode" };
  if (session.payment_status !== "paid") return { ok: false, reason: "unpaid" };

  const priceIds = allowedPriceIds ?? (expectedPriceId ? [expectedPriceId] : []);
  const entitlementKeys = allowedEntitlementKeys ?? (entitlementKey ? [entitlementKey] : []);

  if (entitlementKeys.length && session.metadata?.entitlement_key && !entitlementKeys.includes(session.metadata.entitlement_key)) {
    return { ok: false, reason: "wrong_entitlement" };
  }

  if (!priceIds.length) return { ok: false, reason: "missing_price_config" };

  const userId = normalizeUserId(session.metadata?.supabase_user_id)
    ?? normalizeUserId(session.metadata?.user_id);
  if (!userId) return { ok: false, reason: "missing_user" };

  const matchingItems = lineItems.filter((item) => item.price?.id && priceIds.includes(item.price.id));
  if (matchingItems.length !== 1 || !matchingItems[0].price?.id) return { ok: false, reason: "wrong_price" };
  if ((matchingItems[0].quantity ?? 1) !== 1) return { ok: false, reason: "wrong_quantity" };

  return { ok: true, userId, priceId: matchingItems[0].price.id };
}
