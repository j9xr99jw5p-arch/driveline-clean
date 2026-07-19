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
  const [selected, setSelected] = useState<Record<string, boolean>>(initialState.selected);
  const [quantities, setQuantities] = useState<Record<string, number>>(initialState.quantities);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(initialState.selectedVariants);
  const [attemptedCheckout, setAttemptedCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProducts = products.filter((product) => selected[product.id]);
  const selectedCount = selectedProducts.length;
  const selectedUnitCount = selectedProducts.reduce((count, product) => count + getQuantity(quantities, product.id), 0);
  const selectedTotal = selectedProducts.reduce((total, product) => {
    const price = getDisplayedPriceCents(product, selectedVariants[product.id]);
    return total + ((price ?? 0) * getQuantity(quantities, product.id));
  }, 0);
  const missingVariantIds = selectedProducts
    .filter((product) => product.variants.length > 0 && !selectedVariants[product.id])
    .map((product) => product.id);
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

  async function checkout() {
    setAttemptedCheckout(true);
    if (!selectedCount) {
      setError("Select at least one product to continue.");
      return;
    }
    if (missingVariantIds.length) {
      setError("Choose an option for every selected part before checkout.");
      return;
    }
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/starter-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packSlug,
          items: selectedProducts.map((product) => ({
            productId: product.id,
            variantId: selectedVariants[product.id] || undefined,
            quantity: getQuantity(quantities, product.id)
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
      setLoading(false);
    }
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
                      {product.variants.map((variant) => (
                        <option disabled={!isVariantPurchasable(variant)} key={variant.id} value={variant.id}>
                          {getVariantLabel(variant)}
                        </option>
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
        onCheckout={checkout}
        selectedCount={selectedCount}
        selectedTotal={selectedTotal}
        selectedUnitCount={selectedUnitCount}
      />
    </div>
  );
}

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
  const selected: Record<string, boolean> = {};
  const quantities: Record<string, number> = {};
  const selectedVariants: Record<string, string> = {};

  products.forEach((product) => {
    quantities[product.id] = Math.max(1, Math.min(10, product.packQuantity));
    const purchasableVariants = product.variants.filter(isVariantPurchasable);
    if (purchasableVariants.length === 1) {
      selectedVariants[product.id] = purchasableVariants[0].id;
    }
    if (product.selectedByDefault && getAvailability(product).available) {
      selected[product.id] = true;
    }
  });

  return { selected, quantities, selectedVariants };
}

function getAvailability(product: PackCheckoutProduct) {
  if (product.variants.length) {
    if (!product.variants.some(isVariantPurchasable)) {
      return { available: false, reason: "No purchasable option is available." };
    }
    return { available: true, reason: null };
  }

  if (!product.stripePriceId) {
    return { available: false, reason: "Stripe price unavailable." };
  }

  return { available: true, reason: null };
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
  const details = [
    variant.variantName,
    variant.lightPattern,
    variant.lensColor,
    variant.size,
    variant.finish,
    variant.priceLabel
  ].filter(Boolean);
  return details.join(" / ");
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
