"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeProductCategory, type ProductSummary } from "@/lib/products";

const starterPackItems = [
  {
    title: "Recovery Basics",
    category: "Recovery",
    matchCategories: ["Recovery"],
    description: "Buy this first if you camp, trail ride, or drive solo in bad weather.",
    items: ["Recovery boards", "Tow strap / soft shackles", "Hitch recovery point", "Tire deflator"],
    skip: "Skip flashy recovery gear until you have the basics and know where the truck gets stuck."
  },
  {
    title: "Lighting",
    category: "Lighting",
    matchCategories: ["Lighting"],
    description: "Useful lighting should solve real visibility problems, not just fill blank space.",
    items: ["Ditch lights", "Basic amber fogs", "Bed lighting"],
    skip: "Skip oversized light bars for now if most driving is pavement or mild forest roads."
  },
  {
    title: "Storage & Utility",
    category: "Overland",
    matchCategories: ["Overland", "Interior / Electronics", "Exterior"],
    description: "Small organization upgrades make the truck easier to live with every weekend.",
    items: ["Bed molle panels", "Ratchet straps", "Basic tool kit", "Portable air compressor"],
    skip: "Skip expensive drawer systems until you know what you actually carry."
  },
  {
    title: "Tires First",
    category: "Tires",
    matchCategories: ["Tires"],
    description: "Tires usually matter more than expensive wheels when you are just starting out.",
    items: ["All-terrain tires", "265/70R17 for easy fitment", "285/70R17 only after checking lift and clearance"],
    skip: "Skip new wheels if your budget is tight and the current wheel fitment works."
  },
  {
    title: "Budget Armor",
    category: "Armor",
    matchCategories: ["Armor"],
    description: "Protect what hits the trail. Do not add weight just because it looks built.",
    items: ["Skid plates", "Rock sliders if you actually wheel the truck", "Simple protection before full bumper swaps"],
    skip: "Avoid heavy armor for looks if the truck mostly commutes."
  },
  {
    title: "Beginner Suspension",
    category: "Suspension",
    matchCategories: ["Suspension"],
    description: "A mild, proven setup beats chasing height before you understand fitment.",
    items: ["Mild lift", "Bilstein / OME / Eibach-style budget setups", "Clearance before max height"],
    skip: "Avoid going too high too early; it can create new fitment, ride, and cost problems."
  }
];

export function PartsGrid({ products, categories }: { products: ProductSummary[]; categories: string[] }) {
  const [category, setCategory] = useState("all");
  const filteredProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter((product) => normalizeProductCategory(product.category) === normalizeProductCategory(category));
  }, [category, products]);
  const starterPack = starterPackItems.map((item) => {
    const matchingProducts = products.filter((product) => item.matchCategories
      .some((categoryOption) => normalizeProductCategory(product.category) === normalizeProductCategory(categoryOption)));
    const matchingCategory = categories.find((categoryOption) => item.matchCategories
      .some((starterCategory) => normalizeProductCategory(categoryOption) === normalizeProductCategory(starterCategory)));

    return {
      ...item,
      matchingCategory: matchingCategory ?? item.category,
      product: matchingProducts[0] ?? null,
      productCount: matchingProducts.length
    };
  });

  return (
    <div className="section-stack">
      <section className="parts-starter-section" aria-labelledby="starter-pack-title">
        <div className="parts-starter-head">
          <div>
            <p className="eyebrow">Starter Pack</p>
            <h2 id="starter-pack-title">Overland Tacoma Starter Pack</h2>
            <p className="parts-starter-subtitle">
              Affordable beginner upgrades real Tacoma owners actually recommend - useful gear first, expensive mods later.
            </p>
          </div>
          <p className="muted">
            Start with parts that make the truck more useful, safer, and easier to live with off-road before spending big money on flashy upgrades.
          </p>
        </div>
        <div className="parts-starter-grid">
          {starterPack.map((item) => (
            <article className="parts-starter-card" key={item.title}>
              <p className="eyebrow">{item.productCount ? `${item.productCount} catalog ${item.productCount === 1 ? "pick" : "picks"}` : item.category}</p>
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
              <ul className="parts-starter-list">
                {item.items.map((starterItem) => <li key={starterItem}>{starterItem}</li>)}
              </ul>
              <p className="parts-starter-skip">{item.skip}</p>
              <div className="parts-starter-actions">
                <button type="button" className="button" onClick={() => setCategory(item.matchingCategory)}>
                  View beginner parts
                </button>
                {item.product ? <Link href={`/parts/${item.product.slug}`}>Featured pick</Link> : null}
              </div>
            </article>
          ))}
        </div>
        <div className="parts-starter-cta-row">
          <Link className="button parts-builds-link" href="/builds">See builds using these parts</Link>
          <Link className="button parts-builds-link" href="/check">Check fitment first</Link>
        </div>
      </section>

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
