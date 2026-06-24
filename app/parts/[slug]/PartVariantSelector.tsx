"use client";

import { useState } from "react";
import { getVisibleProductVariants, type ProductVariantOption } from "@/lib/products";
import { ProductCheckoutButton } from "@/app/builds/[id]/ProductCheckoutButton";

export function PartVariantSelector({
  variants
}: {
  variants: ProductVariantOption[];
}) {
  const activeVariants = getVisibleProductVariants(variants);
  const firstVariant = activeVariants[0] ?? null;
  const [lightPattern, setLightPattern] = useState(firstVariant?.lightPattern ?? "");
  const [lensColor, setLensColor] = useState(firstVariant?.lensColor ?? "");
  const [harnessIncluded, setHarnessIncluded] = useState(firstVariant?.harnessIncluded ?? false);
  const [size, setSize] = useState(firstVariant?.size ?? "");
  const [finish, setFinish] = useState(firstVariant?.finish ?? "");
  const lightPatterns = uniqueOptions(activeVariants.map((variant) => variant.lightPattern));
  const lensColors = uniqueOptions(activeVariants.map((variant) => variant.lensColor));
  const harnessOptions = uniqueBooleans(activeVariants.map((variant) => variant.harnessIncluded));
  const sizes = uniqueOptions(activeVariants.map((variant) => variant.size));
  const finishes = uniqueOptions(activeVariants.map((variant) => variant.finish));
  const selectedVariant = activeVariants.find((variant) => (
    (!lightPatterns.length || variant.lightPattern === lightPattern) &&
    (!lensColors.length || variant.lensColor === lensColor) &&
    (!harnessOptions.length || variant.harnessIncluded === harnessIncluded) &&
    (!sizes.length || variant.size === size) &&
    (!finishes.length || variant.finish === finish)
  )) ?? null;
  const selectedVariantInStock = selectedVariant ? selectedVariant.inventoryStatus !== "out_of_stock" : false;

  if (!activeVariants.length) return null;

  return (
    <div className="card part-variant-panel">
      <div>
        <p className="eyebrow">Options</p>
        <h2>Choose a variant</h2>
      </div>
      <div className="variant-selectors">
        <VariantSelect label="Light pattern" options={lightPatterns} value={lightPattern} onChange={setLightPattern} />
        <VariantSelect label="Lens color" options={lensColors} value={lensColor} onChange={setLensColor} />
        {harnessOptions.length > 1 ? (
          <label className="field variant-select harness-toggle">
            <span>Harness <strong>+$50</strong></span>
            <select value={harnessIncluded ? "yes" : "no"} onChange={(event) => setHarnessIncluded(event.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes +$50</option>
            </select>
          </label>
        ) : null}
        <VariantSelect label="Size" options={sizes} value={size} onChange={setSize} />
        <VariantSelect label="Finish" options={finishes} value={finish} onChange={setFinish} />
      </div>
      {selectedVariant ? (
        <div className="part-selected-variant">
          <strong>{selectedVariant.variantName}</strong>
          {selectedVariant.priceLabel ? <span>{selectedVariant.priceLabel}</span> : null}
          {!selectedVariantInStock ? <span>Out of stock</span> : null}
        </div>
      ) : (
        <p className="fine">That option combination is not available.</p>
      )}
      <ProductCheckoutButton disabled={!selectedVariant || !selectedVariantInStock} variantId={selectedVariant?.id ?? null} />
    </div>
  );
}

function VariantSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (options.length <= 1) return null;

  return (
    <label className="field variant-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function uniqueOptions(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function uniqueBooleans(values: boolean[]) {
  return Array.from(new Set(values));
}
