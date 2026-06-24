"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeProductCategory, type ProductSummary } from "@/lib/products";

export function PartsGrid({ products, categories }: { products: ProductSummary[]; categories: string[] }) {
  const [category, setCategory] = useState("all");
  const filteredProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter((product) => normalizeProductCategory(product.category) === normalizeProductCategory(category));
  }, [category, products]);

  return (
    <div className="section-stack">
      {categories.length ? (
        <div className="parts-filter-layout">
          <aside className="card parts-inspiration-card">
            <div>
              <p className="eyebrow">Not sure what to buy?</p>
              <h2>See real Tacoma setups for ideas.</h2>
            </div>
            <Link className="button" href="/builds">Inspiration</Link>
          </aside>
          <div className="card filter-panel">
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
        </div>
      ) : null}

      {filteredProducts.length ? (
        <div className="grid three">
          {filteredProducts.map((product) => (
            <article className="card part-card" key={product.id}>
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
                <div className="part-card-meta">
                  {product.priceLabel ? <strong>{product.priceLabel}</strong> : null}
                  <span>{product.buildCount} verified {product.buildCount === 1 ? "build" : "builds"}</span>
                </div>
                <Link className="button full" href={`/parts/${product.slug}`}>View Part</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <h2>No parts in this category yet.</h2>
          <p className="muted">Try another category or check back as more products are added.</p>
        </div>
      )}
    </div>
  );
}
