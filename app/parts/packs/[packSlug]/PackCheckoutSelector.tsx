"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductVariantOption } from "@/lib/products";

const checkoutErrorMessage = "Pack checkout is having trouble opening right now. Please try again in a moment.";

type PackCheckoutProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  stripePriceId: string | null;
  variants: ProductVariantOption[];
  packQuantity: number;
  selectedByDefault: boolean;
};

type PackCheckoutSelectorProps = {
  packSlug: string;
  products: PackCheckoutProduct[];
};

export function PackCheckoutSelector({ packSlug, products }: PackCheckoutSelectorProps) {
  const initialState = useMemo(() => getInitialState(products), [products]);
  const buyAllItems = useMemo(() => products.map(getBuyAllCheckoutItem).filter((item): item is CheckoutItem => Boolean(item)), [products]);
  const [selected, setSelected] = useState<Record<string, boolean>>(initialState.selected);
  const [quantities, setQuantities] = useState<Record<string, number>>(initialState.quantities);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(initialState.selectedVariants);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [attemptedCheckout, setAttemptedCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buyAllLoading, setBuyAllLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProducts = products.filter((product) => selected[product.id]);
  const selectedCount = selectedProducts.length;
  const selectedUnitCount = selectedProducts.reduce((count, product) => count + getQuantity(quantities, product.id), 0);
  const selectedTotal = selectedProducts.reduce((total, product) => {
    const price = getDisplayedPriceCents(product, selectedVariants[product.id]);
    return total + ((price ?? 0) * getQuantity(quantities, product.id));
  }, 0);
  const selectedAllAvailable = products
    .filter((product) => getAvailability(product).available)
    .every((product) => selected[product.id]);

  function setProductSelected(product: PackCheckoutProduct, nextSelected: boolean) {
    if (!getAvailability(product).available) return;
    setSelected((current) => ({ ...current, [product.id]: nextSelected }));
    setQuantities((current) => ({ ...current, [product.id]: getQuantity(current, product.id, product.packQuantity) }));
    setError(null);
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(1, Math.min(10, nextQuantity))
    }));
  }

  function selectAll() {
    setSelected(Object.fromEntries(products.map((product) => [product.id, getAvailability(product).available])));
    setError(null);
  }

  function clearAll() {
    setSelected({});
    setError(null);
  }

  async function startCheckout(items: CheckoutItem[], emptyMessage: string, setCheckoutLoading: (nextLoading: boolean) => void) {
    if (!items.length) {
      setError(emptyMessage);
      return;
    }
    if (items.some((item) => item.needsVariant)) {
      setError("Choose an option for every selected part before checkout.");
      return;
    }
    if (loading || buyAllLoading) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/starter-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packSlug,
          items: items.map((item) => ({
            productId: item.product.id,
            variantId: item.variantId || undefined,
            quantity: item.quantity
          }))
        })
      });
      const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? checkoutErrorMessage);
      }

      window.location.href = data.url;
    } catch (requestError) {
      console.error("Pack checkout failed", requestError);
      setError(requestError instanceof Error ? requestError.message : checkoutErrorMessage);
      setCheckoutLoading(false);
    }
  }

  async function checkoutSelected() {
    setAttemptedCheckout(true);
    const checkoutItems = selectedProducts.map((product) => ({
      product,
      variantId: selectedVariants[product.id] || null,
      quantity: getQuantity(quantities, product.id),
      needsVariant: product.variants.length > 0 && !selectedVariants[product.id]
    }));

    await startCheckout(checkoutItems, "Select at least one part to continue.", setLoading);
  }

  async function checkoutBuyAll() {
    await startCheckout(buyAllItems, "No in-stock parts are available for Buy All.", setBuyAllLoading);
  }

  if (!products.length) {
    return (
      <div className="pack-empty-state">
        <h2>No products are currently assigned to this pack.</h2>
        <p className="muted">Use Manage Packs in admin to add products without changing their catalog categories.</p>
      </div>
    );
  }

  return (
    <div className="pack-checkout-layout">
      <div className="pack-purchase-choice" aria-label="Pack purchase options">
        <div>
          <p className="eyebrow">Start here</p>
          <h2>Choose how to shop this pack</h2>
          <p className="muted">Buy all in-stock parts that do not need extra choices, or select the exact parts and options you want.</p>
          {buyAllItems.length !== products.length ? <p className="fine">Some parts need an option choice or are out of stock, so they are excluded from Buy All.</p> : null}
        </div>
        <div className="pack-purchase-actions">
          <button className="button primary" disabled={!buyAllItems.length || buyAllLoading || loading} onClick={checkoutBuyAll} type="button">
            {buyAllLoading ? "Opening checkout..." : "Buy All"}
          </button>
          <button
            className="button"
            onClick={() => {
              setSelectionOpen(true);
              setError(null);
            }}
            type="button"
          >
            Select Individual Parts
          </button>
        </div>
      </div>

      {selectionOpen ? (
        <>
      <div className="pack-selection-toolbar" aria-label="Pack selection controls">
        <div>
          <p className="eyebrow">Selected Parts</p>
          <strong>{selectedCount} {selectedCount === 1 ? "part" : "parts"} selected</strong>
        </div>
        <div className="pack-selection-actions">
          <button className="button" disabled={selectedAllAvailable} onClick={selectAll} type="button">Select All</button>
          <button className="button" disabled={!selectedCount} onClick={clearAll} type="button">Clear All</button>
        </div>
      </div>

      <div className="grid three pack-selectable-grid">
        {products.map((product) => {
          const availability = getAvailability(product);
          const isSelected = Boolean(selected[product.id]);
          const quantity = getQuantity(quantities, product.id);
          const selectedVariantId = selectedVariants[product.id] ?? "";
          const missingVariant = attemptedCheckout && isSelected && product.variants.length > 0 && !selectedVariantId;
          const priceLabel = getDisplayedPriceLabel(product, selectedVariantId);

          return (
            <article className={`card part-card pack-selectable-card ${isSelected ? "selected" : ""} ${!availability.available ? "unavailable" : ""}`} key={product.id}>
              <Link className="part-card-image" href={`/parts/${product.slug}`}>
                {product.imageUrl ? (
                  <span className="part-image-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="part-image-bg" src={product.imageUrl} alt="" aria-hidden="true" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="part-image-main" src={product.imageUrl} alt={product.name} />
                  </span>
                ) : <span>{product.category}</span>}
              </Link>
              <div className="part-card-body pack-selectable-body">
                <div className="pack-selectable-head">
                  <p className="eyebrow">{[product.brand, product.category].filter(Boolean).join(" / ")}</p>
                  <button
                    aria-pressed={isSelected}
                    className={`pack-select-button ${isSelected ? "selected" : ""}`}
                    disabled={!availability.available}
                    onClick={() => setProductSelected(product, !isSelected)}
                    type="button"
                  >
                    {isSelected ? "Selected" : "Select part"}
                  </button>
                </div>
                <h3>{product.name}</h3>
                {product.description ? <p className="muted part-card-description">{product.description}</p> : null}
                <div className="part-card-meta">
                  <strong>{priceLabel}</strong>
                  <span>{product.variants.length ? "Option required" : "Ready for checkout"}</span>
                </div>
                {!availability.available ? <p className="form-error">{availability.reason}</p> : null}
                {product.variants.length ? (
                  <label className="field pack-variant-field">
                    <span>Option</span>
                    <select
                      disabled={!isSelected}
                      onChange={(event) => {
                        setSelectedVariants((current) => ({ ...current, [product.id]: event.target.value }));
                        setError(null);
                      }}
                      value={selectedVariantId}
                    >
                      <option value="">Choose an option</option>
                      {getVariantOptionGroups(product.variants).map((group) => group.label ? (
                        <optgroup key={group.label} label={group.label}>
                          {group.variants.map((variant) => (
                            <option disabled={!isVariantPurchasable(variant)} key={variant.id} value={variant.id}>
                              {getVariantLabel(variant)}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        group.variants.map((variant) => (
                          <option disabled={!isVariantPurchasable(variant)} key={variant.id} value={variant.id}>
                            {getVariantLabel(variant)}
                          </option>
                        ))
                      ))}
                    </select>
                  </label>
                ) : null}
                {missingVariant ? <p className="form-error">Choose an option for this part.</p> : null}
                {isSelected ? (
                  <div className="starter-pack-quantity">
                    <span>Qty</span>
                    <button disabled={quantity <= 1} onClick={() => updateQuantity(product.id, quantity - 1)} type="button">-</button>
                    <strong>{quantity}</strong>
                    <button disabled={quantity >= 10} onClick={() => updateQuantity(product.id, quantity + 1)} type="button">+</button>
                  </div>
                ) : null}
                <Link className="button full" href={`/parts/${product.slug}`}>View Part</Link>
              </div>
            </article>
          );
        })}
      </div>

      <PackCheckoutSummary
        error={error}
        loading={loading}
        onCheckout={checkoutSelected}
        selectedCount={selectedCount}
        selectedTotal={selectedTotal}
        selectedUnitCount={selectedUnitCount}
      />
        </>
      ) : null}
    </div>
  );
}

type CheckoutItem = {
  product: PackCheckoutProduct;
  variantId: string | null;
  quantity: number;
  needsVariant: boolean;
};

function PackCheckoutSummary({
  error,
  loading,
  onCheckout,
  selectedCount,
  selectedTotal,
  selectedUnitCount
}: {
  error: string | null;
  loading: boolean;
  onCheckout: () => void;
  selectedCount: number;
  selectedTotal: number;
  selectedUnitCount: number;
}) {
  const disabled = !selectedCount || loading;
  const buttonLabel = loading ? "Opening checkout..." : `Checkout selected (${selectedCount})`;

  return (
    <aside className="starter-pack-summary pack-checkout-summary" aria-label="Selected parts checkout summary">
      <p className="eyebrow">Checkout</p>
      <h2>Selected parts</h2>
      <div className="starter-pack-summary-row">
        <span>{selectedCount} selected {selectedCount === 1 ? "part" : "parts"}</span>
        <strong>{formatDollars(selectedTotal)}</strong>
      </div>
      {selectedUnitCount !== selectedCount ? <p className="fine">{selectedUnitCount} total items including quantities.</p> : null}
      {!selectedCount ? <p className="fine">Select at least one product to continue.</p> : null}
      <button className="button primary full" disabled={disabled} onClick={onCheckout} type="button">
        {buttonLabel}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="starter-pack-summary-links">
        <Link href="/parts">Back to parts</Link>
        <Link href="/check">Check fitment first</Link>
      </div>
    </aside>
  );
}

function getInitialState(products: PackCheckoutProduct[]) {
  const quantities: Record<string, number> = {};
  const selectedVariants: Record<string, string> = {};

  products.forEach((product) => {
    quantities[product.id] = Math.max(1, Math.min(10, product.packQuantity));
    const purchasableVariants = product.variants.filter(isVariantPurchasable);
    if (purchasableVariants.length === 1) {
      selectedVariants[product.id] = purchasableVariants[0].id;
    }
  });

  return { selected: {}, quantities, selectedVariants };
}

function getAvailability(product: PackCheckoutProduct) {
  if (product.variants.length) {
    if (!product.variants.some(isVariantPurchasable)) {
      return { available: false, reason: "Out of stock." };
    }
    return { available: true, reason: null };
  }

  if (!product.stripePriceId) {
    return { available: false, reason: "Stripe price unavailable." };
  }

  return { available: true, reason: null };
}

function getBuyAllCheckoutItem(product: PackCheckoutProduct): CheckoutItem | null {
  if (!getAvailability(product).available) return null;

  const purchasableVariants = product.variants.filter(isVariantPurchasable);
  if (purchasableVariants.length > 1) return null;

  return {
    product,
    variantId: purchasableVariants[0]?.id ?? null,
    quantity: product.packQuantity,
    needsVariant: false
  };
}

function isVariantPurchasable(variant: ProductVariantOption) {
  return Boolean(
    variant.active
    && variant.inventoryStatus !== "inactive"
    && variant.inventoryStatus !== "out_of_stock"
    && Boolean(variant.stripePriceId)
  );
}

function getDisplayedPriceCents(product: PackCheckoutProduct, variantId: string | undefined) {
  const variant = product.variants.find((option) => option.id === variantId);
  return variant?.priceCents ?? product.priceCents;
}

function getDisplayedPriceLabel(product: PackCheckoutProduct, variantId: string | undefined) {
  const variant = product.variants.find((option) => option.id === variantId);
  return variant?.priceLabel ?? product.priceLabel ?? "Price unavailable";
}

function getVariantLabel(variant: ProductVariantOption) {
  const prefixedName = parsePrefixedVariantName(variant.variantName);
  const details = [
    prefixedName?.label ?? variant.variantName,
    variant.lightPattern,
    variant.lensColor,
    variant.size,
    variant.finish,
    variant.priceLabel
  ].filter(Boolean);
  return details.join(" / ");
}

function getVariantOptionGroups(variants: ProductVariantOption[]) {
  const prefixedGroups = variants.reduce<Array<{ label: string; variants: ProductVariantOption[] }>>((groups, variant) => {
    const parsed = parsePrefixedVariantName(variant.variantName);
    if (!parsed) return groups;

    const existingGroup = groups.find((group) => group.label === parsed.group);
    if (existingGroup) {
      existingGroup.variants.push(variant);
      return groups;
    }

    groups.push({ label: parsed.group, variants: [variant] });
    return groups;
  }, []);

  const prefixedVariantCount = prefixedGroups.reduce((count, group) => count + group.variants.length, 0);
  if (prefixedVariantCount === variants.length && prefixedGroups.length > 1) {
    return prefixedGroups;
  }

  return [{ label: "", variants }];
}

function parsePrefixedVariantName(variantName: string) {
  const match = variantName.match(/^(OE|Universal)\s+[—-]\s+(.+)$/i);
  if (!match) return null;

  return {
    group: match[1].toLowerCase() === "oe" ? "OE Colors" : "Universal Colors",
    label: match[2].trim()
  };
}

function getQuantity(quantities: Record<string, number>, productId: string, fallback = 1) {
  return Math.max(1, Math.min(10, quantities[productId] ?? fallback));
}

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}
