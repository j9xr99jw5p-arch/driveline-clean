"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductCheckoutButton } from "./ProductCheckoutButton";

export type BuildProductCardData = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  orderUrl: string | null;
  linkedVariantLabel: string | null;
  linkNotes: string | null;
  variants: BuildProductVariantData[];
};

export type BuildProductVariantData = {
  id: string;
  variantName: string;
  lightPattern: string | null;
  beamPattern: string | null;
  lensColor: string | null;
  harnessIncluded: boolean;
  size: string | null;
  finish: string | null;
  sku: string | null;
  supplierSku: string | null;
  imageUrl: string | null;
  inventoryStatus: string | null;
  priceLabel: string | null;
};

export function BuildProductCarousel({
  products,
  buildId
}: {
  products: BuildProductCardData[];
  buildId: string;
}) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  return (
    <div className="build-products-carousel" aria-label="Parts on this build">
      {products.map((product) => (
        <BuildProductCard
          buildId={buildId}
          isExpanded={expandedProductId === product.id}
          key={product.id}
          onToggle={() => {
            setExpandedProductId(expandedProductId === product.id ? null : product.id);
          }}
          product={product}
        />
      ))}
    </div>
  );
}

function BuildProductCard({
  product,
  buildId,
  isExpanded,
  onToggle
}: {
  product: BuildProductCardData;
  buildId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const activeVariants = product.variants.filter((variant) => variant.inventoryStatus !== "inactive");
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
  const imageUrl = selectedVariant?.imageUrl ?? product.imageUrl;
  const priceLabel = selectedVariant?.priceLabel ?? firstVariant?.priceLabel ?? null;

  return (
    <article className={`card build-product-card ${isExpanded ? "expanded" : ""}`}>
      <button
        className="build-product-summary"
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="build-product-image">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={product.name} />
          ) : (
            <span>{product.category}</span>
          )}
        </div>
        <div className="build-product-compact">
          <p className="eyebrow">{[product.brand, product.category].filter(Boolean).join(" / ")}</p>
          <h3>{product.name}</h3>
          {product.linkedVariantLabel ? <p className="fine">{product.linkedVariantLabel}</p> : null}
          {priceLabel ? <p className="build-product-price">{priceLabel}</p> : null}
        </div>
      </button>

      {isExpanded ? (
        <div className="build-product-expanded">
          {product.description ? <p className="muted">{product.description}</p> : null}
          {product.linkedVariantLabel || product.linkNotes ? (
            <p className="fine">
              {[product.linkedVariantLabel, product.linkNotes].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {lightPatterns.length || lensColors.length || harnessOptions.length > 1 || sizes.length || finishes.length ? (
            <div className="variant-selectors">
              <VariantSelect label="Light pattern" options={lightPatterns} value={lightPattern} onChange={setLightPattern} />
              <VariantSelect label="Lens color" options={lensColors} value={lensColor} onChange={setLensColor} />
              {harnessOptions.length > 1 ? (
                <label className="field variant-select harness-toggle">
                  <span>Harness <strong>+$50</strong></span>
                  <select
                    value={harnessIncluded ? "yes" : "no"}
                    onChange={(event) => setHarnessIncluded(event.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes +$50</option>
                  </select>
                </label>
              ) : null}
              <VariantSelect label="Size" options={sizes} value={size} onChange={setSize} />
              <VariantSelect label="Finish" options={finishes} value={finish} onChange={setFinish} />
            </div>
          ) : null}
          <ProductCheckoutButton
            buildId={buildId}
            disabled={!selectedVariant}
            variantId={selectedVariant?.id ?? null}
          />
          <Link className="button full" href={`/parts/${product.slug}`}>View part details</Link>
          {!selectedVariant ? <p className="fine">That option combination is not available.</p> : null}
        </div>
      ) : null}
    </article>
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
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
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
