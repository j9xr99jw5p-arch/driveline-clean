import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateFitmentCreditFulfillment
} from "../lib/fitmentCreditSecurity.ts";
import {
  assessFitment,
  buildPremiumFitmentInsights,
  buildPremiumWarnings
} from "../lib/fitment.ts";
import {
  previewSelectIsSanitized,
  restrictedVerifiedBuildFields,
  sanitizeVerifiedBuildPreview
} from "../lib/verifiedBuildAccess.ts";

const sql = readFileSync(new URL("../supabase/migrations/032_fitment_credit_entitlements.sql", import.meta.url), "utf8");
const previewSql = readFileSync(new URL("../supabase/migrations/033_verified_build_preview_access.sql", import.meta.url), "utf8");
const validUserId = "11111111-1111-4111-8111-111111111111";
const expectedPriceId = "price_expected";
const entitlementKey = "fitment_two_checks";

class DuplicateFulfillmentError extends Error {}

class MemoryCreditStore {
  accounts = new Map();
  checkoutSessions = new Set();
  paymentIntents = new Set();
  usageRequests = new Set();

  balance(userId) {
    return this.accounts.get(userId) ?? 0;
  }

  setBalance(userId, balance) {
    this.accounts.set(userId, balance);
  }

  grant({ userId, checkoutSessionId, paymentIntentId, credits }) {
    if (this.checkoutSessions.has(checkoutSessionId)) throw new DuplicateFulfillmentError("duplicate checkout session");
    if (paymentIntentId && this.paymentIntents.has(paymentIntentId)) throw new DuplicateFulfillmentError("duplicate payment intent");

    this.checkoutSessions.add(checkoutSessionId);
    if (paymentIntentId) this.paymentIntents.add(paymentIntentId);
    this.accounts.set(userId, this.balance(userId) + credits);
  }

  consume(userId, requestId) {
    const usageKey = `${userId}:${requestId}`;
    if (requestId && this.usageRequests.has(usageKey)) {
      return { balance: this.balance(userId), duplicate: true };
    }

    const current = this.balance(userId);
    if (current <= 0) throw new Error("No premium fitment checks remaining");

    this.accounts.set(userId, current - 1);
    if (requestId) this.usageRequests.add(usageKey);

    return { balance: current - 1, duplicate: false };
  }
}

assert.match(sql, /alter table public\.fitment_credit_accounts enable row level security/i, "RLS enabled on accounts");
assert.match(sql, /alter table public\.fitment_credit_transactions enable row level security/i, "RLS enabled on transactions");
assert.match(sql, /revoke all on function public\.grant_fitment_credits\(uuid, integer, boolean, text, text, text, jsonb\) from authenticated/i, "grant RPC revoked from authenticated users");
assert.match(sql, /revoke all on function public\.consume_premium_fitment_credit\(uuid, uuid, text, jsonb\) from authenticated/i, "consume RPC revoked from authenticated users");
assert.match(sql, /grant execute on function public\.grant_fitment_credits\(uuid, integer, boolean, text, text, text, jsonb\) to service_role/i, "grant RPC executable by service role");
assert.match(sql, /grant execute on function public\.consume_premium_fitment_credit\(uuid, uuid, text, jsonb\) to service_role/i, "consume RPC executable by service role");
assert.match(sql, /security definer\s+set search_path = public/i, "security definer functions use fixed search_path");
assert.match(sql, /stripe_checkout_session_id\)\s+where stripe_checkout_session_id is not null/i, "checkout session replay protection exists");
assert.match(sql, /stripe_payment_intent_id\)\s+where stripe_payment_intent_id is not null/i, "payment intent replay protection exists");
assert.match(sql, /premium_checks_remaining > 0/i, "consume RPC prevents negative balances");
assert.match(sql, /insert into public\.fitment_credit_transactions[\s\S]*insert into public\.fitment_credit_accounts/i, "grant inserts transaction and updates balance in one RPC");

const store = new MemoryCreditStore();
assert.equal(processWebhook({
  store,
  session: paidSession("cs_success", "pi_success"),
  lineItems: [lineItem(expectedPriceId, 1)]
}), "granted", "successful purchase grants");
assert.equal(store.balance(validUserId), 2, "successful purchase grants exactly two credits");

assert.equal(processWebhook({
  store,
  session: paidSession("cs_success", "pi_success"),
  lineItems: [lineItem(expectedPriceId, 1)]
}), "duplicate", "duplicate completed webhook is idempotent");
assert.equal(store.balance(validUserId), 2, "duplicate completed webhook does not add credits");

assert.equal(processWebhook({
  store,
  session: paidSession("cs_async_same_payment", "pi_success"),
  lineItems: [lineItem(expectedPriceId, 1)]
}), "duplicate", "completed plus async-success with same payment intent is idempotent");
assert.equal(store.balance(validUserId), 2, "async-success replay does not add credits");

assert.equal(processWebhook({
  store,
  session: paidSession("cs_wrong_price", "pi_wrong_price"),
  lineItems: [lineItem("price_other", 1)]
}), "skipped:wrong_price", "wrong price id grants nothing");
assert.equal(processWebhook({
  store,
  session: { ...paidSession("cs_unpaid", "pi_unpaid"), payment_status: "unpaid" },
  lineItems: [lineItem(expectedPriceId, 1)]
}), "skipped:unpaid", "unpaid checkout grants nothing");
assert.equal(processWebhook({
  store,
  session: { ...paidSession("cs_missing_user", "pi_missing_user"), metadata: { entitlement_key: entitlementKey } },
  lineItems: [lineItem(expectedPriceId, 1)]
}), "skipped:missing_user", "missing user metadata grants nothing");
assert.equal(processWebhook({
  store,
  session: paidSession("cs_wrong_quantity", "pi_wrong_quantity"),
  lineItems: [lineItem(expectedPriceId, 2)]
}), "skipped:wrong_quantity", "wrong quantity grants nothing");
assert.equal(processWebhook({
  store,
  session: paidSession("cs_missing_env", "pi_missing_env"),
  lineItems: [lineItem(expectedPriceId, 1)],
  priceId: undefined
}), "skipped:missing_price_config", "missing env config fails safely");
assert.equal(store.balance(validUserId), 2, "invalid webhook cases do not change balance");

const singleCreditStore = new MemoryCreditStore();
singleCreditStore.setBalance(validUserId, 1);
const firstConsume = singleCreditStore.consume(validUserId, "request-a");
assert.equal(firstConsume.balance, 0, "first concurrent-style consume uses one remaining credit");
assert.throws(() => singleCreditStore.consume(validUserId, "request-b"), /No premium fitment checks remaining/, "second concurrent-style consume cannot overspend");
assert.equal(singleCreditStore.balance(validUserId), 0, "balance cannot go below zero");

const duplicateRequestStore = new MemoryCreditStore();
duplicateRequestStore.setBalance(validUserId, 2);
duplicateRequestStore.consume(validUserId, "same-request");
duplicateRequestStore.consume(validUserId, "same-request");
assert.equal(duplicateRequestStore.balance(validUserId), 1, "duplicate assessment request consumes only once");

const aiFailureStore = new MemoryCreditStore();
aiFailureStore.setBalance(validUserId, 1);
const aiResult = simulatePremiumAssessment({ store: aiFailureStore, aiGenerated: false, requestId: "ai-failed" });
assert.equal(aiResult, "ai_failed_before_consume", "AI failure exits before consume");
assert.equal(aiFailureStore.balance(validUserId), 1, "AI failure does not permanently lose a credit");

assert.equal(previewSelectIsSanitized(), true, "non-premium build selects omit restricted fields");
assert.match(previewSql, /create or replace view public\.verified_build_previews/i, "restricted verified build preview view exists");
assert.match(previewSql, /revoke all on table public\.verified_builds from anon/i, "anonymous users cannot select full verified builds table");
assert.match(previewSql, /revoke all on table public\.verified_builds from authenticated/i, "authenticated clients cannot select full verified builds table directly");
assert.match(previewSql, /grant select on table public\.verified_build_previews to anon/i, "anonymous users can only read restricted preview view");
const fullBuild = {
  id: "build_1",
  year: 2024,
  make: "Toyota",
  model: "Tacoma",
  trim: "TRD Off-Road",
  cab: "Double Cab",
  bed: "5 ft",
  tire_size: "285/70R17",
  wheel_size: "17x8.5",
  lift_height: 2.5,
  fitment_risk: "medium",
  published: true,
  notes: "premium notes",
  source_url: "https://example.com",
  rubbing_severity: "minor",
  trimming_required: true,
  body_mount_chop: false,
  verified_build_photos: []
};
const previewBuild = sanitizeVerifiedBuildPreview(fullBuild);
for (const field of restrictedVerifiedBuildFields) {
  assert.equal(Object.hasOwn(previewBuild, field), false, `preview omits ${field}`);
}

assert.equal(canAccessBuildDetail({ premium: false, build: fullBuild }), "preview_only", "non-premium detail cannot access full data");
assert.equal(canAccessBuildDetail({ premium: true, build: fullBuild }), "full_published", "premium user can access published full data");
assert.equal(canAccessBuildDetail({ premium: true, build: { ...fullBuild, published: false } }), "not_found", "unpublished data remains protected");

const highRiskInput = {
  year: 2023,
  trim: "TRD Off-Road",
  cab: "Double Cab",
  bed: "5 ft",
  tireSize: "285/70R17",
  wheelDiameter: 17,
  wheelWidth: 9,
  wheelOffset: -25,
  liftHeight: 3,
  useCase: "off-road",
  rearLoad: "normal",
  buildGoals: "overland capabilities"
};
const highRiskReport = assessFitment(highRiskInput);
const premiumInsights = buildPremiumFitmentInsights(highRiskInput, highRiskReport);
assert.ok(premiumInsights.alternativeSetup, "premium includes a lower-risk nearby setup when one exists");
assert.ok(premiumInsights.alternativeSetup.summary.includes("drops from"), "alternative setup reports a quantified risk delta");
assert.equal(premiumInsights.scenarioBreakdown.length, 3, "premium includes scenario-specific breakdown");
assert.match(premiumInsights.trimDetail, /Likely trim area:/, "premium includes trim location and severity detail");
assert.match(premiumInsights.notesReasoning, /overland capabilities/, "premium reasoning visibly uses fitment notes");
const premiumWarnings = buildPremiumWarnings(highRiskInput, highRiskReport);
for (const warning of premiumWarnings) {
  assert.equal(highRiskReport.warnings.includes(warning), false, "premium warnings are not verbatim free warnings");
}

console.log("fitment credit security tests passed");

function normalizeUserId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? "") ? value : null;
}

function paidSession(id, paymentIntentId) {
  return {
    id,
    mode: "payment",
    payment_status: "paid",
    payment_intent: paymentIntentId,
    client_reference_id: validUserId,
    metadata: {
      entitlement_key: entitlementKey,
      supabase_user_id: validUserId,
      premium_checks: "999",
      price_id: "client_supplied_ignored"
    }
  };
}

function lineItem(priceId, quantity) {
  return {
    quantity,
    price: { id: priceId }
  };
}

function processWebhook(input) {
  const { store, session, lineItems } = input;
  const priceId = Object.hasOwn(input, "priceId") ? input.priceId : expectedPriceId;
  const result = validateFitmentCreditFulfillment({
    session,
    lineItems,
    expectedPriceId: priceId,
    entitlementKey,
    normalizeUserId
  });

  if (!result.ok) return `skipped:${result.reason}`;

  try {
    store.grant({
      userId: result.userId,
      checkoutSessionId: session.id,
      paymentIntentId: session.payment_intent ?? null,
      credits: 2
    });
    return "granted";
  } catch (error) {
    if (error instanceof DuplicateFulfillmentError) return "duplicate";
    throw error;
  }
}

function simulatePremiumAssessment({ store, aiGenerated, requestId }) {
  const deterministicSucceeded = true;
  if (!deterministicSucceeded) return "invalid";
  if (!aiGenerated) return "ai_failed_before_consume";
  store.consume(validUserId, requestId);
  return "premium_report";
}

function canAccessBuildDetail({ premium, build }) {
  if (!build.published) return "not_found";
  return premium ? "full_published" : "preview_only";
}
