import assert from "node:assert/strict";
import {
  creditPacks,
  findCreditPackByPriceId,
  FREE_STARTING_CREDITS,
  getCreditPackPriceId,
  listConfiguredOneTimePriceIds
} from "../lib/creditPacks.ts";
import { validateFitmentCreditFulfillment } from "../lib/fitmentCreditSecurity.ts";

assert.equal(FREE_STARTING_CREDITS, 12);
assert.equal(creditPacks.credits_50.credits, 50);
assert.equal(creditPacks.credits_150.credits, 150);
assert.equal(creditPacks.priority.credits, 250);
assert.equal(creditPacks.credits_50.mode, "payment");
assert.equal(creditPacks.credits_150.mode, "payment");
assert.equal(creditPacks.priority.mode, "subscription");
assert.equal(getCreditPackPriceId(creditPacks.credits_50), "price_1UIHFQAxOgxntpwRlocHgdap");
assert.equal(getCreditPackPriceId(creditPacks.credits_150), "price_1UIHC6AxOgxntpwRt1gaVjOf");
assert.equal(getCreditPackPriceId(creditPacks.priority), "price_1UIHHGAxOgxntpwRiLkQNDRG");
assert.equal(findCreditPackByPriceId("price_1UIHC6AxOgxntpwRt1gaVjOf")?.credits, 150);

const userId = "11111111-1111-4111-8111-111111111111";
const allowedPriceIds = listConfiguredOneTimePriceIds();
const plus = validateFitmentCreditFulfillment({
  session: {
    id: "cs_150",
    mode: "payment",
    payment_status: "paid",
    metadata: { entitlement_key: "credits_150", supabase_user_id: userId }
  },
  lineItems: [{ quantity: 1, price: { id: "price_1UIHC6AxOgxntpwRt1gaVjOf" } }],
  allowedPriceIds,
  allowedEntitlementKeys: ["credits_50", "credits_150"],
  normalizeUserId: (value) => value ?? null
});
assert.equal(plus.ok, true);
if (plus.ok) {
  assert.equal(plus.priceId, "price_1UIHC6AxOgxntpwRt1gaVjOf");
  assert.equal(findCreditPackByPriceId(plus.priceId)?.credits, 150);
}

const skipped = validateFitmentCreditFulfillment({
  session: {
    id: "cs_old",
    mode: "payment",
    payment_status: "paid",
    metadata: { entitlement_key: "credits_150", supabase_user_id: userId }
  },
  lineItems: [{ quantity: 1, price: { id: "price_old_two_checks" } }],
  allowedPriceIds,
  allowedEntitlementKeys: ["credits_50", "credits_150"],
  normalizeUserId: (value) => value ?? null
});
assert.equal(skipped.ok, false);

console.log("credit pack tests passed");
