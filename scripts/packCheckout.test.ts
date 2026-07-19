import assert from "node:assert/strict";
import {
  buildOrderItemRows,
  buildStarterPackCheckoutPlan,
  type OrderItemRow,
  type PackCheckoutRow,
  type SavedCheckoutSelectionItem,
  type StripeWebhookLineItem
} from "../lib/packCheckout";

const ids = {
  pack: "11111111-1111-4111-8111-111111111111",
  net: "2fa83d89-539b-43db-b0f8-76a411075b02",
  vault: "26bbb24a-c66e-456d-ac72-57026c10be32",
  inserts: "a0ae10c3-1ba4-4ea1-9565-9e28458b27f8",
  visor: "f40cac46-99bd-409d-a351-f9ca0af5df1c",
  netVariant: "9b49691b-535f-4468-a9b0-23c0b575f9ab",
  vaultVariant: "75887beb-7e16-4014-b306-3f463a2da4ce",
  insertsVariant: "603f5684-408e-415f-85e3-de31076a19ee",
  visorVariant: "94ca13ad-c777-4a11-8a6b-8704b2bc2f20"
};

const storagePack: PackCheckoutRow = {
  id: ids.pack,
  slug: "storage",
  pack_products: [
    product(ids.net, ids.netVariant, "Overland Storage Net", "price_net", 5499),
    product(ids.vault, ids.vaultVariant, "Tacoma Lifestyle Center Console Vault", "price_vault", 20999),
    product(ids.inserts, ids.insertsVariant, "Tacoma Lifestyle Smartphone Door Inserts", "price_inserts", 6299),
    product(ids.visor, ids.visorVariant, "Tacoma Lifestyle Tactical Sun Visor Molle Panel", "price_visor", 2499)
  ]
};

const checkoutPlan = buildStarterPackCheckoutPlan(storagePack, [
  { productId: ids.net, variantId: ids.netVariant, quantity: 1 },
  { productId: ids.vault, variantId: ids.vaultVariant, quantity: 2 },
  { productId: ids.inserts, variantId: ids.insertsVariant, quantity: 1 },
  { productId: ids.visor, variantId: ids.visorVariant, quantity: 3 }
]);

assert.equal(checkoutPlan.lineItems.length, 4, "creates one Checkout Session payload with four Stripe line items");
assert.deepEqual(checkoutPlan.lineItems.map((item) => item.price), [
  "price_net",
  "price_vault",
  "price_inserts",
  "price_visor"
], "Stripe price ids come from trusted server product/variant data");
assert.deepEqual(checkoutPlan.lineItems.map((item) => item.quantity), [1, 2, 1, 3], "quantities are preserved");
assert.deepEqual(checkoutPlan.selectionItems.map((item) => item.product_id), [ids.net, ids.vault, ids.inserts, ids.visor], "saved selection contains all products");
assert.deepEqual(checkoutPlan.selectionItems.map((item) => item.variant_id), [ids.netVariant, ids.vaultVariant, ids.insertsVariant, ids.visorVariant], "saved selection preserves variants");

const overriddenClientPricePlan = buildStarterPackCheckoutPlan(storagePack, [
  { productId: ids.net, variantId: ids.netVariant, quantity: 1, priceCents: 1 } as never
]);
assert.equal(overriddenClientPricePlan.lineItems[0].price, "price_net", "client-sent price data is ignored");

const sameAmountPack: PackCheckoutRow = {
  ...storagePack,
  pack_products: [
    product(ids.net, ids.netVariant, "Overland Storage Net", "price_same_amount_a", 5499),
    product(ids.inserts, ids.insertsVariant, "Tacoma Lifestyle Smartphone Door Inserts", "price_same_amount_b", 5499)
  ]
};
const sameAmountPlan = buildStarterPackCheckoutPlan(sameAmountPack, [
  { productId: ids.net, variantId: ids.netVariant, quantity: 1 },
  { productId: ids.inserts, variantId: ids.insertsVariant, quantity: 1 }
]);
assert.deepEqual(sameAmountPlan.lineItems.map((item) => item.price), ["price_same_amount_a", "price_same_amount_b"], "same amount products map by Stripe price id, not amount");

const stripeLineItems: StripeWebhookLineItem[] = [
  stripeLine("li_visor", "price_visor", 3, 2499, "usd"),
  stripeLine("li_net", "price_net", 1, 5499, "usd"),
  stripeLine("li_inserts", "price_inserts", 1, 6299, "usd"),
  stripeLine("li_vault", "price_vault", 2, 20999, "usd")
];

class MemoryOrderStore {
  private orders = new Map<string, { id: string; sessionId: string; total: number }>();
  private orderItems = new Map<string, OrderItemRow>();

  get orderCount() {
    return this.orders.size;
  }

  get orderItemCount() {
    return this.orderItems.size;
  }

  upsertOrder(order: { id: string; sessionId: string; total: number }) {
    this.orders.set(order.sessionId, order);
  }

  upsertOrderItems(rowsToWrite: OrderItemRow[], fail = false) {
    if (fail) throw new Error("simulated order item write failure");
    rowsToWrite.forEach((row) => {
      if (!row.stripe_line_item_id) throw new Error("missing Stripe line item id");
      this.orderItems.set(row.stripe_line_item_id, row);
    });
  }

  totalForSession(sessionId: string) {
    return this.orders.get(sessionId)?.total ?? null;
  }
}

const rows = buildOrderItemRows({
  orderId: "order_1",
  sessionId: "cs_test_123",
  sessionCurrency: "usd",
  selectedItems: checkoutPlan.selectionItems,
  stripeLineItems
});

assert.equal(rows.length, 4, "webhook creates four order item rows");
assert.equal(rows[0].stripe_line_item_id, "li_net", "out-of-order Stripe line items map to the correct product");
assert.equal(rows[1].product_id, ids.vault, "variant product maps correctly");
assert.equal(rows[1].variant_id, ids.vaultVariant, "variant id maps correctly");
assert.equal(rows[1].quantity, 2, "Stripe quantity is recorded");
assert.equal(rows[1].unit_amount, 20999, "unit price is recorded");
assert.equal(rows[1].amount_total, 41998, "line total is recorded");
assert.equal(rows[1].currency, "usd", "currency is recorded");

const db = new MemoryOrderStore();
db.upsertOrder({ id: "order_1", sessionId: "cs_test_123", total: 104493 });
db.upsertOrderItems(rows);
db.upsertOrder({ id: "order_1", sessionId: "cs_test_123", total: 104493 });
db.upsertOrderItems(rows);
assert.equal(db.orderCount, 1, "webhook replay still has one order");
assert.equal(db.orderItemCount, 4, "webhook replay still has four order items");
assert.equal(db.totalForSession("cs_test_123"), 104493, "checkout-level total matches the Stripe Session total");

const retryDb = new MemoryOrderStore();
retryDb.upsertOrder({ id: "order_2", sessionId: "cs_test_retry", total: 104493 });
assert.throws(() => retryDb.upsertOrderItems(rows, true), /simulated order item write failure/);
assert.equal(retryDb.orderCount, 1, "partial first attempt wrote one order");
assert.equal(retryDb.orderItemCount, 0, "partial first attempt wrote no order items");
retryDb.upsertOrder({ id: "order_2", sessionId: "cs_test_retry", total: 104493 });
retryDb.upsertOrderItems(rows.map((row) => ({ ...row, order_id: "order_2", stripe_checkout_session_id: "cs_test_retry" })));
assert.equal(retryDb.orderCount, 1, "retry keeps one order");
assert.equal(retryDb.orderItemCount, 4, "retry completes missing order items");

console.log("pack checkout automated tests passed");

function product(productId: string, variantId: string, name: string, priceId: string, priceCents: number) {
  return {
    product_id: productId,
    products: {
      id: productId,
      name,
      category: "Storage",
      description: null,
      image_url: null,
      price_cents: priceCents,
      stripe_price_id: null,
      active: true,
      inventory_status: "in_stock",
      product_variants: [{
        id: variantId,
        product_id: productId,
        variant_name: "Standard",
        stripe_price_id: priceId,
        active: true,
        inventory_status: "in_stock",
        price_cents: priceCents
      }]
    }
  };
}

function stripeLine(id: string, priceId: string, quantity: number, unitAmount: number, currency: string): StripeWebhookLineItem {
  return {
    id,
    quantity,
    amount_subtotal: unitAmount * quantity,
    amount_total: unitAmount * quantity,
    currency,
    price: {
      id: priceId,
      unit_amount: unitAmount
    }
  };
}
