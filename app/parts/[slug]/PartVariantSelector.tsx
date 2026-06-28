"use client";

import { useMemo, useState } from "react";
import { formatCents, getVisibleProductVariants, type ProductVariantOption } from "@/lib/products";
import { ProductCheckoutButton } from "@/app/builds/[id]/ProductCheckoutButton";

type ParsedVariant = {
  variant: ProductVariantOption;
  parts: string[];
};

type OptionGroup = {
  index: number;
  label: string;
  values: string[];
};

export function PartVariantSelector({
  variants,
  compact = false
}: {
  variants: ProductVariantOption[];
  compact?: boolean;
}) {
  const activeVariants = getVisibleProductVariants(variants);
  const groupedOptions = useMemo(() => buildGroupedOptions(activeVariants), [activeVariants]);

  if (!activeVariants.length) return null;

  if (groupedOptions) {
    return <GroupedVariantSelector activeVariants={activeVariants} compact={compact} groupedOptions={groupedOptions} />;
  }

  return <VariantCardFallback activeVariants={activeVariants} compact={compact} />;
}

function GroupedVariantSelector({
  activeVariants,
  compact,
  groupedOptions
}: {
  activeVariants: ProductVariantOption[];
  compact: boolean;
  groupedOptions: { groups: OptionGroup[]; parsedVariants: ParsedVariant[] };
}) {
  const firstParsedVariant = groupedOptions.parsedVariants[0];
  const [selections, setSelections] = useState<string[]>(firstParsedVariant?.parts ?? []);
  const selectedParsedVariant = groupedOptions.parsedVariants.find((parsed) => (
    parsed.parts.every((part, index) => normalizePart(part) === normalizePart(selections[index]))
  )) ?? null;
  const selectedVariant = selectedParsedVariant?.variant ?? null;
  const selectedVariantInStock = selectedVariant ? selectedVariant.inventoryStatus !== "out_of_stock" : false;

  return (
    <div className={compact ? "part-variant-panel compact" : "card part-variant-panel"}>
      <div className="part-option-head">
        <p className="eyebrow">Choose option</p>
        <p className="fine">Select one option from each group before checkout.</p>
      </div>
      <div className="variant-group-stack">
        {groupedOptions.groups.map((group) => (
          <fieldset className="variant-option-group" key={group.index}>
            <legend>{group.label}</legend>
            <div className="variant-pill-row">
              {group.values.map((value) => {
                const selected = normalizePart(selections[group.index]) === normalizePart(value);
                const nextSelections = selections.map((current, index) => index === group.index ? value : current);
                const optionAvailable = Boolean(findMatchingParsedVariant(groupedOptions.parsedVariants, nextSelections));

                return (
                  <button
                    className={`variant-pill-option ${selected ? "selected" : ""}`}
                    disabled={!optionAvailable}
                    key={value}
                    onClick={() => setSelections(nextSelections)}
                    type="button"
                  >
                    <span>{normalizeOptionLabel(value)}</span>
                    {formatOptionDelta(groupedOptions.parsedVariants, group.index, value, selections) ? (
                      <small>{formatOptionDelta(groupedOptions.parsedVariants, group.index, value, selections)}</small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {selectedVariant && selectedParsedVariant ? (
        <div className="part-selected-variant grouped">
          <span>
            <small>Selected setup</small>
            <strong>{selectedParsedVariant.parts.map(normalizeOptionLabel).join(" · ")}</strong>
          </span>
          <span className="variant-option-price">
            <small>Price</small>
            {selectedVariant.priceLabel ?? "Price unavailable"}
            {!selectedVariantInStock ? <small>Out of stock</small> : null}
          </span>
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

function VariantCardFallback({
  activeVariants,
  compact
}: {
  activeVariants: ProductVariantOption[];
  compact: boolean;
}) {
  const firstVariant = activeVariants[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState(firstVariant?.id ?? "");
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? firstVariant;
  const selectedVariantInStock = selectedVariant ? selectedVariant.inventoryStatus !== "out_of_stock" : false;

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

function buildGroupedOptions(variants: ProductVariantOption[]) {
  if (variants.length <= 1) return null;

  const parsedVariants = variants.map((variant) => ({
    variant,
    parts: parseVariantParts(variant.variantName)
  }));
  const partCount = parsedVariants[0]?.parts.length ?? 0;

  if (partCount < 2 || !parsedVariants.every((parsed) => parsed.parts.length === partCount)) {
    return null;
  }

  const signatures = new Set(parsedVariants.map((parsed) => parsed.parts.map(normalizePart).join("|")));
  if (signatures.size !== parsedVariants.length) return null;

  const groups = Array.from({ length: partCount }, (_, index) => {
    const values = uniqueValues(parsedVariants.map((parsed) => parsed.parts[index]));
    return {
      index,
      label: getGroupLabel(index, values, parsedVariants),
      values
    };
  });

  if (!groups.some((group) => group.values.length > 1)) return null;

  return { groups, parsedVariants };
}

function parseVariantParts(variantName?: string | null) {
  const source = variantName ?? "";
  const spacedParts = source.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  if (spacedParts.length > 1) return spacedParts;

  return source
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeOptionLabel(value: string) {
  const normalized = normalizePart(value);

  if (normalized === "harness yes") return "Add harness";
  if (normalized === "harness no") return "No harness";
  if (normalized === "dielectric grease yes" || normalized === "grease") return "Add grease";
  if (normalized === "dielectric grease no" || normalized === "no grease") return "No grease";
  if (normalized === "protective film yes" || normalized === "yellow film") return "Yellow film";
  if (normalized === "protective film no" || normalized === "no film") return "No film";

  return value;
}

function getGroupLabel(index: number, values: string[], parsedVariants: ParsedVariant[]) {
  const normalizedValues = values.map(normalizePart);
  const allParts = parsedVariants.flatMap((parsed) => parsed.parts).map(normalizePart);

  if (normalizedValues.every((value) => value.startsWith("harness "))) return "Harness";
  if (normalizedValues.every((value) => value.includes("grease"))) return "Dielectric grease";
  if (normalizedValues.every((value) => value.includes("film"))) return "Protective film";
  if (normalizedValues.some((value) => value.includes("amber") || value.includes("clear")) && !normalizedValues.some((value) => value.includes("harness"))) return "Lens color";
  if (allParts.some((value) => value.startsWith("harness ")) && index === 0) return "Beam pattern";
  if (allParts.some((value) => value.startsWith("harness ")) && index === 1) return "Lens color";

  return `Option ${index + 1}`;
}

function findMatchingParsedVariant(parsedVariants: ParsedVariant[], selections: string[]) {
  return parsedVariants.find((parsed) => (
    parsed.parts.every((part, index) => normalizePart(part) === normalizePart(selections[index]))
  )) ?? null;
}

function formatOptionDelta(parsedVariants: ParsedVariant[], groupIndex: number, value: string, selections: string[]) {
  const matchingCurrentContext = parsedVariants.filter((parsed) => (
    parsed.parts.every((part, index) => index === groupIndex || normalizePart(part) === normalizePart(selections[index]))
  ));
  const comparisonPool = matchingCurrentContext.length ? matchingCurrentContext : parsedVariants;
  const optionPrices = comparisonPool
    .filter((parsed) => normalizePart(parsed.parts[groupIndex]) === normalizePart(value))
    .map((parsed) => parsed.variant.priceCents)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  const baselinePrices = comparisonPool
    .map((parsed) => parsed.variant.priceCents)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));

  if (!optionPrices.length || !baselinePrices.length) return null;

  const delta = Math.min(...optionPrices) - Math.min(...baselinePrices);
  if (delta <= 0) return null;

  return `+${formatCents(delta)}`;
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

function uniqueValues(values: string[]) {
  const seen = new Map<string, string>();
  values.forEach((value) => {
    const key = normalizePart(value);
    if (!seen.has(key)) seen.set(key, value);
  });
  return Array.from(seen.values());
}

function normalizePart(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
