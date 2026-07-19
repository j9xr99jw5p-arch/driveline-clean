export type ProductVariantCheckoutRow = {
  id: string;
  product_id: string;
  variant_name: string;
  stripe_price_id: string | null;
  active: boolean;
  inventory_status?: string | null;
  price_cents: number | null;
};

export type ProductCheckoutRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  stripe_price_id: string | null;
  active: boolean;
  inventory_status?: string | null;
  product_variants?: ProductVariantCheckoutRow[] | null;
};

export type PackCheckoutRow = {
  id: string;
  slug: string;
  pack_products?: Array<{
    product_id: string;
    products: ProductCheckoutRow | ProductCheckoutRow[] | null;
  }> | null;
};

export type CheckoutRequestItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type ValidatedCheckoutItem = {
  product: ProductCheckoutRow;
  variant: ProductVariantCheckoutRow | null;
  quantity: number;
  stripePriceId: string;
};

export type SavedCheckoutSelectionItem = {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  stripe_price_id: string;
  quantity: number;
};

export type CheckoutLineItem = {
  price: string;
  quantity: number;
  adjustable_quantity: {
    enabled: boolean;
    minimum: number;
    maximum: number;
  };
};

export type StripeWebhookLineItem = {
  id: string | null;
  quantity: number | null;
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
  price?: { id?: string | null; unit_amount?: number | null } | null;
};

export type OrderItemRow = {
  order_id: string;
  stripe_checkout_session_id: string;
  stripe_line_item_id: string | null;
  product_id: string;
  variant_id: string | null;
  stripe_price_id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_amount: number | null;
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
};

export class PackCheckoutValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PackCheckoutValidationError";
    this.status = status;
  }
}

export function buildStarterPackCheckoutPlan(pack: PackCheckoutRow, requestItems: CheckoutRequestItem[]) {
  const duplicateProductId = findDuplicate(requestItems.map((item) => item.productId));
  if (duplicateProductId) {
    throw new PackCheckoutValidationError("Each selected product can only be submitted once.");
  }

  const packProducts = new Map((pack.pack_products ?? [])
    .map((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      return product ? [product.id, product] : null;
    })
    .filter((entry): entry is [string, ProductCheckoutRow] => Boolean(entry)));

  const validatedItems = requestItems.map((item) => {
    const product = packProducts.get(item.productId);
    if (!product) {
      throw new PackCheckoutValidationError("One or more selected parts are no longer assigned to this pack.", 404);
    }

    return validateCheckoutItem(product, item);
  });

  const duplicatePriceId = findDuplicate(validatedItems.map((item) => item.stripePriceId));
  if (duplicatePriceId) {
    throw new PackCheckoutValidationError("Two selected parts share the same Stripe price. Please contact support before checkout.", 409);
  }

  return {
    validatedItems,
    lineItems: validatedItems.map(buildCheckoutLineItem),
    selectionItems: validatedItems.map(buildSelectionItem)
  };
}

export function buildOrderItemRows({
  orderId,
  sessionId,
  sessionCurrency,
  selectedItems,
  stripeLineItems
}: {
  orderId: string;
  sessionId: string;
  sessionCurrency: string | null;
  selectedItems: SavedCheckoutSelectionItem[];
  stripeLineItems: StripeWebhookLineItem[];
}): OrderItemRow[] {
  const duplicateSelectionPriceId = findDuplicate(selectedItems.map((item) => item.stripe_price_id));
  if (duplicateSelectionPriceId) {
    throw new Error(`Cannot map order items because selection contains duplicate Stripe price ${duplicateSelectionPriceId}.`);
  }

  const duplicateLinePriceId = findDuplicate(stripeLineItems.map((item) => item.price?.id).filter((value): value is string => Boolean(value)));
  if (duplicateLinePriceId) {
    throw new Error(`Cannot map order items because Stripe returned duplicate price ${duplicateLinePriceId}.`);
  }

  const lineItemsByPrice = new Map(stripeLineItems.map((item) => [item.price?.id ?? "", item]));

  return selectedItems.map((item) => {
    const stripeLineItem = lineItemsByPrice.get(item.stripe_price_id);
    if (!stripeLineItem) {
      throw new Error(`Missing Stripe line item for price ${item.stripe_price_id}.`);
    }
    if (!stripeLineItem.id) {
      throw new Error(`Missing Stripe line item id for price ${item.stripe_price_id}.`);
    }

    const quantity = stripeLineItem.quantity ?? item.quantity;

    return {
      order_id: orderId,
      stripe_checkout_session_id: sessionId,
      stripe_line_item_id: stripeLineItem.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      stripe_price_id: item.stripe_price_id,
      product_name: item.product_name,
      variant_name: item.variant_name,
      quantity,
      unit_amount: stripeLineItem.price?.unit_amount ?? calculateUnitAmount(stripeLineItem.amount_subtotal, quantity),
      amount_subtotal: stripeLineItem.amount_subtotal ?? null,
      amount_total: stripeLineItem.amount_total ?? null,
      currency: stripeLineItem.currency ?? sessionCurrency
    };
  });
}

export function normalizeSelectedItems(value: unknown): SavedCheckoutSelectionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (
        typeof row.product_id !== "string"
        || typeof row.product_name !== "string"
        || typeof row.stripe_price_id !== "string"
      ) return null;

      const quantity = typeof row.quantity === "number" && Number.isInteger(row.quantity) && row.quantity > 0
        ? row.quantity
        : 1;

      return {
        product_id: row.product_id,
        variant_id: typeof row.variant_id === "string" ? row.variant_id : null,
        product_name: row.product_name,
        variant_name: typeof row.variant_name === "string" ? row.variant_name : null,
        stripe_price_id: row.stripe_price_id,
        quantity
      };
    })
    .filter((item): item is SavedCheckoutSelectionItem => Boolean(item));
}

function validateCheckoutItem(product: ProductCheckoutRow, item: CheckoutRequestItem): ValidatedCheckoutItem {
  const activeVariants = (product.product_variants ?? [])
    .filter((variant) => variant.active && variant.inventory_status !== "inactive");

  if (!product.active || product.inventory_status === "inactive") {
    throw new PackCheckoutValidationError(`${product.name} is not available for checkout.`, 409);
  }

  if (product.inventory_status === "out_of_stock") {
    throw new PackCheckoutValidationError(`${product.name} is currently out of stock.`, 409);
  }

  if (activeVariants.length) {
    if (!item.variantId) {
      throw new PackCheckoutValidationError(`Choose an option for ${product.name} before checkout.`);
    }

    const variant = activeVariants.find((option) => option.id === item.variantId);
    if (!variant || variant.product_id !== product.id) {
      throw new PackCheckoutValidationError(`The selected option for ${product.name} is not available.`);
    }

    if (variant.inventory_status === "out_of_stock") {
      throw new PackCheckoutValidationError(`${product.name} is currently out of stock.`, 409);
    }

    if (!variant.stripe_price_id) {
      throw new PackCheckoutValidationError(`${product.name} is missing Stripe pricing. Please remove it or choose another option.`, 409);
    }

    return {
      product,
      variant,
      quantity: item.quantity,
      stripePriceId: variant.stripe_price_id
    };
  }

  if (item.variantId) {
    throw new PackCheckoutValidationError(`${product.name} does not use selectable options.`);
  }

  if (!product.stripe_price_id) {
    throw new PackCheckoutValidationError(`${product.name} is missing Stripe pricing. Please remove it and try again.`, 409);
  }

  return {
    product,
    variant: null,
    quantity: item.quantity,
    stripePriceId: product.stripe_price_id
  };
}

function buildCheckoutLineItem(item: ValidatedCheckoutItem): CheckoutLineItem {
  return {
    price: item.stripePriceId,
    quantity: item.quantity,
    adjustable_quantity: {
      enabled: true,
      minimum: 1,
      maximum: 10
    }
  };
}

function buildSelectionItem(item: ValidatedCheckoutItem): SavedCheckoutSelectionItem {
  return {
    product_id: item.product.id,
    variant_id: item.variant?.id ?? null,
    product_name: item.product.name,
    variant_name: item.variant?.variant_name ?? null,
    stripe_price_id: item.stripePriceId,
    quantity: item.quantity
  };
}

function calculateUnitAmount(amountSubtotal: number | null | undefined, quantity: number) {
  if (typeof amountSubtotal !== "number" || quantity <= 0) return null;
  return Math.round(amountSubtotal / quantity);
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  return values.find((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  }) ?? null;
}
