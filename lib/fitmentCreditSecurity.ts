export const currentVerifiedBuildAccessLabel = "Included access";
export const currentVerifiedBuildAccessDescription =
  "Verified Builds access is included with the current $14 one-time premium check purchase. No recurring subscription is required.";

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
  | { ok: true; userId: string }
  | { ok: false; reason: "wrong_mode" | "unpaid" | "wrong_entitlement" | "missing_user" | "wrong_price" | "wrong_quantity" | "missing_price_config" };

export function validateFitmentCreditFulfillment({
  session,
  lineItems,
  expectedPriceId,
  entitlementKey,
  normalizeUserId
}: {
  session: FitmentCreditSessionLike;
  lineItems: FitmentCreditLineItem[];
  expectedPriceId: string | undefined;
  entitlementKey: string;
  normalizeUserId: (value: string | null | undefined) => string | null;
}): FitmentCreditFulfillmentCheck {
  if (session.mode !== "payment") return { ok: false, reason: "wrong_mode" };
  if (session.payment_status !== "paid") return { ok: false, reason: "unpaid" };
  if (session.metadata?.entitlement_key !== entitlementKey) return { ok: false, reason: "wrong_entitlement" };
  if (!expectedPriceId) return { ok: false, reason: "missing_price_config" };

  const userId = normalizeUserId(session.metadata?.supabase_user_id)
    ?? normalizeUserId(session.metadata?.user_id);
  if (!userId) return { ok: false, reason: "missing_user" };

  const matchingItems = lineItems.filter((item) => item.price?.id === expectedPriceId);
  if (matchingItems.length !== 1) return { ok: false, reason: "wrong_price" };
  if ((matchingItems[0].quantity ?? 1) !== 1) return { ok: false, reason: "wrong_quantity" };

  return { ok: true, userId };
}
