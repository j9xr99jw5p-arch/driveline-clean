"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StarterPack } from "@/lib/starterPackTypes";

const checkoutErrorMessage =
  "We could not start checkout for this starter pack. Please try again in a moment.";

export function StarterPackCheckout({ packs }: { packs: StarterPack[] }) {
  const [activePackSlug, setActivePackSlug] = useState(packs[0]?.slug ?? "");
  const activePack = packs.find((pack) => pack.slug === activePackSlug) ?? packs[0];
  const initialSelected = useMemo(() => getDefaultSelected(activePack), [activePack]);
  const [selectedByPack, setSelectedByPack] = useState<Record<string, Record<string, number>>>(() => (
    packs.reduce<Record<string, Record<string, number>>>((state, pack) => {
      state[pack.slug] = getDefaultSelected(pack);
      return state;
    }, {})
  ));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = selectedByPack[activePack.slug] ?? initialSelected;
  const selectedProducts = activePack.groups
    .flatMap((group) => group.products)
    .filter((product) => selected[product.id]);
  const selectedCount = selectedProducts.reduce((count, product) => count + (selected[product.id] ?? 0), 0);
  const selectedTotal = selectedProducts.reduce((total, product) => total + ((product.priceCents ?? 0) * (selected[product.id] ?? 0)), 0);
  const hasUnpricedSelection = selectedProducts.some((product) => product.priceCents === null);

  function updateSelected(nextSelected: Record<string, number>) {
    setSelectedByPack((current) => ({
      ...current,
      [activePack.slug]: nextSelected
    }));
  }

  function toggleProduct(productId: string, recommendedQuantity: number, checked: boolean) {
    const nextSelected = { ...selected };
    if (checked) {
      nextSelected[productId] = recommendedQuantity;
    } else {
      delete nextSelected[productId];
    }
    updateSelected(nextSelected);
  }

  function updateQuantity(productId: string, quantity: number) {
    updateSelected({
      ...selected,
      [productId]: Math.max(1, Math.min(10, quantity))
    });
  }

  async function checkout() {
    if (!selectedCount || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/starter-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_slug: activePack.slug,
          items: Object.entries(selected).map(([partId, quantity]) => ({
            part_id: partId,
            quantity
          }))
        })
      });
      const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? checkoutErrorMessage);
      }

      window.location.href = data.url;
    } catch (requestError) {
      console.error("Starter pack checkout failed", requestError);
      setError(requestError instanceof Error ? requestError.message : checkoutErrorMessage);
      setLoading(false);
    }
  }

  if (!activePack) {
    return (
      <div className="starter-pack-empty">
        <h2>No starter packs are available yet.</h2>
        <p className="muted">Use Manage Packs in admin to assign active products to this checkout flow.</p>
      </div>
    );
  }

  return (
    <div className="starter-pack-checkout">
      <div className="starter-pack-tabs" role="tablist" aria-label="Starter packs">
        {packs.map((pack) => (
          <button
            aria-selected={pack.slug === activePack.slug}
            className={pack.slug === activePack.slug ? "active" : ""}
            key={pack.slug}
            onClick={() => setActivePackSlug(pack.slug)}
            role="tab"
            type="button"
          >
            {pack.name}
          </button>
        ))}
      </div>

      <section className="starter-pack-hero" aria-labelledby="starter-pack-checkout-title">
        <div>
          <p className="eyebrow">Selectable Starter Pack</p>
          <h1 id="starter-pack-checkout-title">{activePack.name}</h1>
          <p className="starter-pack-subtitle">{activePack.subtitle}</p>
        </div>
        <p className="lead">{activePack.description}</p>
      </section>

      <div className="starter-pack-layout">
        <div className="starter-pack-groups">
          {activePack.groups.map((group) => (
            <section className="starter-pack-group" key={group.title}>
              <div className="starter-pack-group-head">
                <div>
                  <p className="eyebrow">{group.category}</p>
                  <h2>{group.title}</h2>
                </div>
                <p className="muted">{group.note}</p>
              </div>

              <ul className="starter-pack-placeholder-list" aria-label={`${group.title} recommendations`}>
                {group.items.map((item) => <li key={item}>{item}</li>)}
              </ul>

              {group.products.length ? (
                <div className="starter-pack-items">
                  {group.products.map((product) => {
                    const quantity = selected[product.id] ?? 0;
                    const selectedProduct = quantity > 0;
                    return (
                      <article className={`starter-pack-item ${selectedProduct ? "selected" : ""}`} key={product.id}>
                        <label>
                          <input
                            checked={selectedProduct}
                            disabled={product.required}
                            onChange={(event) => toggleProduct(product.id, product.recommendedQuantity, event.target.checked)}
                            type="checkbox"
                          />
                          <span className="starter-pack-item-image">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.imageUrl} alt="" />
                            ) : <span>{product.category}</span>}
                          </span>
                          <span className="starter-pack-item-copy">
                            <span className="starter-pack-item-meta">
                              <span>{product.required ? "Required" : product.defaultSelected ? "Recommended" : "Optional"}</span>
                              {product.budgetTier ? <span>{product.budgetTier}</span> : null}
                            </span>
                            <strong>{product.name}</strong>
                            <span className="muted">{[product.brand, product.category].filter(Boolean).join(" / ")}</span>
                            {product.note ? <span className="starter-pack-item-note">{product.note}</span> : null}
                            <span className="starter-pack-item-price">{product.priceLabel ?? "Price unavailable"}</span>
                          </span>
                        </label>
                        {selectedProduct ? (
                          <div className="starter-pack-quantity">
                            <span>Qty</span>
                            <button type="button" onClick={() => updateQuantity(product.id, quantity - 1)} disabled={product.required && quantity <= product.recommendedQuantity}>-</button>
                            <strong>{quantity}</strong>
                            <button type="button" onClick={() => updateQuantity(product.id, quantity + 1)}>+</button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="starter-pack-placeholder-copy">
                  No live catalog items are connected to this group yet. Use Manage Packs in admin to make this group checkout-ready.
                </p>
              )}
            </section>
          ))}
        </div>

        <aside className="starter-pack-summary" aria-label="Starter pack checkout summary">
          <p className="eyebrow">Checkout</p>
          <h2>Selected parts</h2>
          <div className="starter-pack-summary-row">
            <span>{selectedCount} selected {selectedCount === 1 ? "item" : "items"}</span>
            <strong>{formatDollars(selectedTotal)}</strong>
          </div>
          {hasUnpricedSelection ? (
            <p className="fine">Some items need Stripe to confirm the final price. The server will validate every selected part before checkout opens.</p>
          ) : null}
          <button className="button primary full" disabled={!selectedCount || loading} onClick={checkout} type="button">
            {loading ? "Opening checkout..." : "Checkout selected items"}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="starter-pack-summary-links">
            <Link href="/parts">Back to parts</Link>
            <Link href="/check">Check fitment first</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function getDefaultSelected(pack: StarterPack) {
  return pack.groups.reduce<Record<string, number>>((selected, group) => {
    group.products.forEach((product) => {
      if (product.defaultSelected || product.required) {
        selected[product.id] = product.recommendedQuantity;
      }
    });
    return selected;
  }, {});
}

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}
