"use client";

import { useMemo, useState } from "react";
import type { AdminStoreProductManagementData, AdminStoreProductRow } from "@/app/admin/_components/AdminTools";

type StatusFilter = "all" | "active" | "inactive";
type SortMode = "name" | "category" | "updated";

export function AdminStoreProductsManager({ data }: { data: AdminStoreProductManagementData }) {
  const [products, setProducts] = useState(data.products);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products
      .filter((product) => {
        const matchesQuery = !normalizedQuery
          || product.name.toLowerCase().includes(normalizedQuery)
          || (product.brand ?? "").toLowerCase().includes(normalizedQuery);
        const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
        const matchesStatus = statusFilter === "all"
          || (statusFilter === "active" ? product.active : !product.active);
        const matchesInventory = inventoryFilter === "all" || (product.inventoryStatus ?? "unknown") === inventoryFilter;

        return matchesQuery && matchesCategory && matchesStatus && matchesInventory;
      })
      .sort((left, right) => {
        if (sortMode === "category") {
          return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
        }
        if (sortMode === "updated") {
          return getDateTime(right.updatedAt) - getDateTime(left.updatedAt) || left.name.localeCompare(right.name);
        }
        return left.name.localeCompare(right.name);
      });
  }, [categoryFilter, inventoryFilter, products, query, sortMode, statusFilter]);

  async function updateProduct(product: AdminStoreProductRow, updates: { active?: boolean; packSlugs?: string[] }) {
    if (updates.active === false && !window.confirm(`Remove ${product.name} from the public store? Product records, variants, images, reviews, and Stripe IDs will be kept.`)) {
      return;
    }

    setPendingProductId(product.id);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          ...updates
        })
      });
      const payload = await response.json().catch(() => ({})) as { product?: AdminStoreProductRow; error?: string; message?: string };

      if (!response.ok || !payload.product) {
        throw new Error(payload.error ?? "Product update failed.");
      }

      setProducts((current) => current.map((item) => item.id === product.id ? payload.product! : item));
      setMessage({ type: "success", text: payload.message ?? "Product updated." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Product update failed." });
    } finally {
      setPendingProductId(null);
    }
  }

  return (
    <section className="card admin-store-products admin-compact-card">
      <div className="admin-panel-head">
        <div>
          <p className="eyebrow">Storefront</p>
          <h2>Manage Store Products</h2>
          <p className="muted">Add or remove existing products from the public store without deleting Supabase records.</p>
        </div>
        <span className="admin-store-count">{filteredProducts.length} of {products.length}</span>
      </div>

      <div className="admin-store-filters" aria-label="Store product filters">
        <label className="field">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or brand" />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {data.categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="field">
          <span>Inventory</span>
          <select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value)}>
            <option value="all">All inventory</option>
            {data.inventoryStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="name">Alphabetically</option>
            <option value="category">Category</option>
            <option value="updated">Most recently updated</option>
          </select>
        </label>
      </div>

      {message ? <p className={message.type === "success" ? "form-success" : "form-error"}>{message.text}</p> : null}

      {filteredProducts.length ? (
        <div className="admin-store-product-list">
          {filteredProducts.map((product) => {
            const busy = pendingProductId === product.id;

            return (
              <article className="admin-store-product-row" key={product.id}>
                <div className="admin-store-thumb">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt="" aria-hidden="true" />
                  ) : <span>{product.category.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="admin-store-product-main">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{[product.brand, product.category].filter(Boolean).join(" / ")}</span>
                  </div>
                  <div className="admin-store-product-meta">
                    <span>{product.priceLabel}</span>
                    <span>{formatStatus(product.inventoryStatus ?? "unknown")}</span>
                    <span>{product.activeVariantCount} active {product.activeVariantCount === 1 ? "variant" : "variants"}</span>
                    <span className={product.active ? "status-pill active" : "status-pill inactive"}>{product.active ? "In store" : "Hidden"}</span>
                  </div>
                </div>
                <fieldset className="admin-store-pack-field">
                  <legend>Packs</legend>
                  {data.packs.map((pack) => {
                    const checked = product.packSlugs.includes(pack.slug);
                    return (
                      <label key={pack.slug}>
                        <input
                          checked={checked}
                          disabled={busy}
                          onChange={(event) => {
                            const nextPackSlugs = event.target.checked
                              ? [...product.packSlugs, pack.slug]
                              : product.packSlugs.filter((slug) => slug !== pack.slug);
                            updateProduct(product, { packSlugs: Array.from(new Set(nextPackSlugs)) });
                          }}
                          type="checkbox"
                        />
                        <span>{pack.name.replace(" Pack", "")}</span>
                      </label>
                    );
                  })}
                </fieldset>
                <div className="admin-store-actions">
                  <button
                    className={product.active ? "button danger" : "button primary"}
                    disabled={busy}
                    onClick={() => updateProduct(product, { active: !product.active })}
                    type="button"
                  >
                    {busy ? "Saving..." : product.active ? "Remove from Store" : "Add to Store"}
                  </button>
                  {product.slug ? <a className="button" href={`/parts/${product.slug}`} target="_blank" rel="noreferrer">View</a> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">No products match those filters.</p>
      )}
    </section>
  );
}

function getDateTime(value: string | null) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
