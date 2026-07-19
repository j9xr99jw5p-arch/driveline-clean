"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PackSummary } from "@/lib/packs";
import { getProductReviewSummary, getReviewPreviewText, normalizeProductCategory, type ProductSummary } from "@/lib/products";

export function PartsGrid({ products, categories, packs }: { products: ProductSummary[]; categories: string[]; packs: PackSummary[] }) {
  const [category, setCategory] = useState("all");
  const starterScrollRef = useRef<HTMLElement | null>(null);
  const starterCardRefs = useRef<Array<HTMLElement | null>>([]);
  const filteredProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter((product) => normalizeProductCategory(product.category) === normalizeProductCategory(category));
  }, [category, products]);

  useStarterPackScrollAnimation(starterScrollRef, starterCardRefs);

  return (
    <div className="parts-page-layout">
      <aside className="parts-helper-sidebar" aria-label="Parts help and starter packs" ref={starterScrollRef}>
        <div>
          <p className="eyebrow">Parts Help</p>
          <h2>Not sure what to buy?</h2>
          <p className="muted">
            Start with the parts that make your Tacoma more useful first. Check real builds, confirm fitment, or choose a starter pack based on what you actually need.
          </p>
        </div>
        <div className="parts-helper-actions">
          <Link className="button full" href="/builds">See builds using these parts</Link>
          <Link className="button full" href="/check">Check fitment</Link>
        </div>
        <div className="parts-pack-nav">
          <p className="eyebrow">Starter packs</p>
          <div className="parts-pack-buttons">
            {packs.map((pack, index) => (
              <article
                className="parts-pack-card"
                key={pack.slug}
                ref={(node) => {
                  starterCardRefs.current[index] = node;
                }}
              >
                <div>
                  <h3>{pack.name}</h3>
                  <p className="muted">{pack.description}</p>
                </div>
                <Link className="button full" href={`/parts/packs/${pack.slug}`}>
                  View {pack.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </aside>

      <main className="parts-catalog-main">
        {categories.length ? (
          <section className="parts-filter-layout">
            <div className="filter-panel parts-filter-panel">
              <div>
                <p className="eyebrow">Categories</p>
                <h2>Filter the parts catalog.</h2>
              </div>
              <div className="parts-category-filter" role="list" aria-label="Part categories">
                <button className={category === "all" ? "active" : ""} type="button" onClick={() => setCategory("all")}>All</button>
                {categories.map((option) => (
                  <button
                    className={normalizeProductCategory(category) === normalizeProductCategory(option) ? "active" : ""}
                    key={normalizeProductCategory(option)}
                    type="button"
                    onClick={() => setCategory(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <p className="muted">{filteredProducts.length} of {products.length} parts shown</p>
            </div>
          </section>
        ) : null}

        {filteredProducts.length ? (
          <div className="grid three">
            {filteredProducts.map((product) => <PartCatalogCard product={product} key={product.id} />)}
          </div>
        ) : (
          <div className="card">
            <h2>No parts in this category yet.</h2>
            <p className="muted">Try another category or check back as more products are added.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function useStarterPackScrollAnimation(
  scrollRef: RefObject<HTMLElement | null>,
  cardRefs: RefObject<Array<HTMLElement | null>>
) {
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const desktopQuery = window.matchMedia("(min-width: 1025px) and (pointer: fine)");

    const setMobileState = () => {
      cardRefs.current.forEach((card) => {
        if (!card) return;
        card.style.opacity = "";
        card.style.transform = "";
      });
    };

    const updateCards = () => {
      if (!desktopQuery.matches) {
        setMobileState();
        return;
      }

      const containerHeight = scrollContainer.clientHeight;
      cardRefs.current.forEach((card) => {
        if (!card) return;
        const cardTop = card.offsetTop - scrollContainer.scrollTop;
        const distance = containerHeight + card.offsetHeight;
        const progress = Math.min(Math.max((containerHeight - cardTop) / distance, 0), 1);
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        const yOffset = Math.round((1 - easedProgress) * 18);

        card.style.opacity = String(0.48 + easedProgress * 0.52);
        card.style.transform = `translateY(${yOffset}px)`;
      });
    };

    updateCards();
    scrollContainer.addEventListener("scroll", updateCards, { passive: true });
    desktopQuery.addEventListener("change", updateCards);

    const resizeObserver = new ResizeObserver(updateCards);
    resizeObserver.observe(scrollContainer);
    cardRefs.current.forEach((card) => {
      if (card) resizeObserver.observe(card);
    });

    return () => {
      scrollContainer.removeEventListener("scroll", updateCards);
      desktopQuery.removeEventListener("change", updateCards);
      resizeObserver.disconnect();
    };
  }, [scrollRef, cardRefs]);
}

export function PartCatalogCard({ product }: { product: ProductSummary }) {
  const ownerReview = getProductReviewSummary(product);
  const reviewPreview = getReviewPreviewText(ownerReview?.summary);

  return (
    <article className="card part-card">
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
      <div className="part-card-body">
        <p className="eyebrow">{[product.brand, product.category].filter(Boolean).join(" / ")}</p>
        <h3>{product.name}</h3>
        {product.description ? <p className="muted part-card-description">{product.description}</p> : null}
        <div className="part-card-meta">
          {product.priceLabel ? <strong>{product.priceLabel}</strong> : null}
          <span>{product.buildCount} verified {product.buildCount === 1 ? "build" : "builds"}</span>
        </div>
        {ownerReview && (ownerReview.sentimentLabel || reviewPreview) ? (
          <div className="part-card-review">
            {ownerReview.sentimentLabel ? (
              <p className="part-card-review-label">Owner consensus: <strong>{ownerReview.sentimentLabel}</strong></p>
            ) : null}
            {reviewPreview ? <p className="muted part-card-review-text">{reviewPreview}</p> : null}
          </div>
        ) : null}
        <Link className="button full" href={`/parts/${product.slug}`}>View Part</Link>
      </div>
    </article>
  );
}
