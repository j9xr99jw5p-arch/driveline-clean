"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PackSummary } from "@/lib/packs";
import { normalizeProductCategory, type ProductSummary } from "@/lib/products";

export function PartsGrid({ products, categories, packs }: { products: ProductSummary[]; categories: string[]; packs: PackSummary[] }) {
  const [category, setCategory] = useState("all");
  const filteredProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter((product) => normalizeProductCategory(product.category) === normalizeProductCategory(category));
  }, [category, products]);

  return (
    <div className="parts-page-layout">
      <aside className="parts-helper-sidebar" aria-label="Parts help and starter packs">
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
            {packs.map((pack) => (
              <article className="parts-pack-card" key={pack.slug}>
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

export function PartCatalogCard({ product }: { product: ProductSummary }) {
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
        <Link className="button full" href={`/parts/${product.slug}`}>View Part</Link>
      </div>
    </article>
  );
}
