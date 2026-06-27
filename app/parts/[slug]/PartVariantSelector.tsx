"use client";

import { useState } from "react";
import { getVisibleProductVariants, type ProductVariantOption } from "@/lib/products";
import { ProductCheckoutButton } from "@/app/builds/[id]/ProductCheckoutButton";

export function PartVariantSelector({
  variants,
  compact = false
}: {
  variants: ProductVariantOption[];
  compact?: boolean;
}) {
  const activeVariants = getVisibleProductVariants(variants);
  const firstVariant = activeVariants[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState(firstVariant?.id ?? "");
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? firstVariant;
  const selectedVariantInStock = selectedVariant ? selectedVariant.inventoryStatus !== "out_of_stock" : false;

  if (!activeVariants.length) return null;

  return (
    <div className={compact ? "part-variant-panel compact" : "card part-variant-panel"}>
      <div className="part-option-head">
        <p className="eyebrow">Choose option</p>
        <p className="fine">Select the setup you want before checkout.</p>
      </div>
      <div className="variant-card-grid" role="radiogroup" aria-label="Product options">
        {activeVariants.map((variant) => {
          const selected = variant.id === selectedVariant?.id;
          const inStock = variant.inventoryStatus !== "out_of_stock";

          return (
            <button
              aria-checked={selected}
              className={`variant-option-card ${selected ? "selected" : ""}`}
              disabled={!inStock}
              key={variant.id}
              onClick={() => setSelectedVariantId(variant.id)}
              role="radio"
              type="button"
            >
              <span>
                <strong>{formatVariantName(variant)}</strong>
                <small>{formatVariantDetails(variant)}</small>
              </span>
              <span className="variant-option-price">
                {variant.priceLabel ?? "Price unavailable"}
                {!inStock ? <small>Out of stock</small> : null}
              </span>
            </button>
          );
        })}
      </div>
      {selectedVariant ? (
        <div className="part-selected-variant">
          <strong>{formatVariantName(selectedVariant)}</strong>
          {selectedVariant.priceLabel ? <span>{selectedVariant.priceLabel}</span> : null}
          {!selectedVariantInStock ? <span>Out of stock</span> : null}
        </div>
      ) : (
        <p className="fine">That option combination is not available.</p>
      )}
      <ProductCheckoutButton
        disabled={!selectedVariant || !selectedVariantInStock}
        label="Buy selected option"
        variantId={selectedVariant?.id ?? null}
      />
    </div>
  );
}

function formatVariantName(variant: ProductVariantOption) {
  const normalizedName = variant.variantName.trim().toLowerCase();
  if (normalizedName && !["default", "standard", "single option", "one option", "base"].includes(normalizedName)) {
    return variant.variantName;
  }

  return [
    variant.dielectricGreaseIncluded === null ? null : variant.dielectricGreaseIncluded ? "Grease" : "No grease",
    variant.protectiveFilmIncluded === null ? null : variant.protectiveFilmIncluded ? "Yellow film" : "No film",
    variant.lensColor,
    variant.lightPattern,
    variant.size,
    variant.finish
  ].filter(Boolean).join(" / ") || "Standard option";
}

function formatVariantDetails(variant: ProductVariantOption) {
  const details = [
    variant.dielectricGreaseIncluded === null ? null : `Dielectric grease: ${variant.dielectricGreaseIncluded ? "Yes" : "No"}`,
    variant.protectiveFilmIncluded === null ? null : `Yellow film: ${variant.protectiveFilmIncluded ? "Yes" : "No"}`,
    variant.harnessIncluded ? "Harness included" : null,
    variant.sku ? `SKU ${variant.sku}` : null
  ].filter(Boolean);

  return details.join(" • ");
}
