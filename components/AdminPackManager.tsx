"use client";

import { ArrowDown, ArrowUp, Plus, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export type PackAdminProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
};

export type PackAdminAssignment = {
  productId: string;
  sortOrder: number;
  quantity: number;
  selectedByDefault: boolean;
};

export type PackAdminPack = {
  id: string;
  name: string;
  slug: string;
  assignments: PackAdminAssignment[];
};

export type PackManagementData = {
  packs: PackAdminPack[];
  products: PackAdminProduct[];
  categories: string[];
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string | null;
};

export function AdminPackManager({ data }: { data: PackManagementData }) {
  const [selectedPackId, setSelectedPackId] = useState(data.packs[0]?.id ?? "");
  const [assignmentsByPack, setAssignmentsByPack] = useState<Record<string, PackAdminAssignment[]>>(() => (
    Object.fromEntries(data.packs.map((pack) => [pack.id, dedupeAssignments(pack.assignments)]))
  ));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: null });

  const selectedPack = useMemo(
    () => data.packs.find((pack) => pack.id === selectedPackId) ?? data.packs[0],
    [data.packs, selectedPackId]
  );
  const assignments = useMemo(
    () => selectedPack ? assignmentsByPack[selectedPack.id] ?? [] : [],
    [assignmentsByPack, selectedPack]
  );
  const assignedIds = useMemo(() => new Set(assignments.map((assignment) => assignment.productId)), [assignments]);
  const productById = useMemo(() => new Map(data.products.map((product) => [product.id, product])), [data.products]);
  const normalizedQuery = query.trim().toLowerCase();

  const availableProducts = data.products.filter((product) => {
    const categoryMatches = category === "all" || (product.category ?? "Uncategorized") === category;
    const textMatches = !normalizedQuery || `${product.name} ${product.brand ?? ""}`.toLowerCase().includes(normalizedQuery);
    return categoryMatches && textMatches;
  });

  function updateAssignments(nextAssignments: PackAdminAssignment[]) {
    if (!selectedPack) return;
    setAssignmentsByPack((current) => ({
      ...current,
      [selectedPack.id]: nextAssignments.map((assignment, index) => ({ ...assignment, sortOrder: index }))
    }));
    setSaveState({ status: "idle", message: null });
  }

  function addProduct(productId: string) {
    if (assignedIds.has(productId)) return;
    updateAssignments([
      ...assignments,
      {
        productId,
        sortOrder: assignments.length,
        quantity: 1,
        selectedByDefault: true
      }
    ]);
  }

  function removeProduct(productId: string) {
    updateAssignments(assignments.filter((assignment) => assignment.productId !== productId));
  }

  function moveProduct(productId: string, direction: -1 | 1) {
    const index = assignments.findIndex((assignment) => assignment.productId === productId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= assignments.length) return;

    const nextAssignments = [...assignments];
    [nextAssignments[index], nextAssignments[nextIndex]] = [nextAssignments[nextIndex], nextAssignments[index]];
    updateAssignments(nextAssignments);
  }

  function updateAssignment(productId: string, patch: Partial<PackAdminAssignment>) {
    updateAssignments(assignments.map((assignment) => (
      assignment.productId === productId ? { ...assignment, ...patch } : assignment
    )));
  }

  async function savePack() {
    if (!selectedPack || saveState.status === "saving") return;

    setSaveState({ status: "saving", message: "Saving pack..." });

    try {
      const response = await fetch("/api/admin/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_id: selectedPack.id,
          assignments: assignments.map((assignment, index) => ({
            product_id: assignment.productId,
            sort_order: index,
            quantity: assignment.quantity,
            selected_by_default: assignment.selectedByDefault
          }))
        })
      });
      const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Pack changes could not be saved.");
      }

      setSaveState({ status: "success", message: payload?.message ?? "Pack saved." });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Pack changes could not be saved."
      });
    }
  }

  if (!data.packs.length) {
    return (
      <section className="card admin-pack-manager admin-compact-card">
        <p className="eyebrow">Manage Packs</p>
        <h2>No packs are configured.</h2>
        <p className="muted">Run the pack-management migration to create the public packs.</p>
      </section>
    );
  }

  return (
    <section className="card admin-pack-manager admin-compact-card">
      <div className="admin-panel-head">
        <div>
          <p className="eyebrow">Manage Packs</p>
          <h2>Pack products</h2>
        </div>
        <label className="field admin-pack-selector">
          <span>Pack</span>
          <select value={selectedPack?.id ?? ""} onChange={(event) => {
            setSelectedPackId(event.target.value);
            setSaveState({ status: "idle", message: null });
          }}>
            {data.packs.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-pack-layout">
        <div className="admin-pack-column">
          <div className="admin-pack-column-head">
            <h3>Available Products</h3>
            <span>{availableProducts.length}</span>
          </div>
          <div className="admin-pack-filters">
            <label className="field">
              <span>Search</span>
              <span className="admin-pack-search">
                <Search size={16} aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or brand" />
              </span>
            </label>
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {data.categories.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>{categoryName}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-pack-product-list">
            {availableProducts.map((product) => {
              const assigned = assignedIds.has(product.id);
              return (
                <div className="admin-pack-product-row" key={product.id}>
                  <ProductLabel product={product} />
                  <button className="button icon-button" disabled={assigned} onClick={() => addProduct(product.id)} title={assigned ? "Already in pack" : "Add product"} type="button">
                    <Plus size={16} aria-hidden="true" />
                    <span>{assigned ? "Added" : "Add"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-pack-column">
          <div className="admin-pack-column-head">
            <h3>Products in This Pack</h3>
            <span>{assignments.length}</span>
          </div>
          {assignments.length ? (
            <div className="admin-pack-assignment-list">
              {assignments.map((assignment, index) => {
                const product = productById.get(assignment.productId);
                if (!product) return null;

                return (
                  <div className="admin-pack-assignment-row" key={assignment.productId}>
                    <div className="admin-pack-reorder" aria-label={`Reorder ${product.name}`}>
                      <button className="button icon-only" disabled={index === 0} onClick={() => moveProduct(assignment.productId, -1)} title="Move up" type="button">
                        <ArrowUp size={16} aria-hidden="true" />
                      </button>
                      <button className="button icon-only" disabled={index === assignments.length - 1} onClick={() => moveProduct(assignment.productId, 1)} title="Move down" type="button">
                        <ArrowDown size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <ProductLabel product={product} />
                    <label className="field admin-pack-quantity">
                      <span>Qty</span>
                      <input
                        min={1}
                        max={10}
                        step={1}
                        type="number"
                        value={assignment.quantity}
                        onChange={(event) => updateAssignment(assignment.productId, {
                          quantity: clampQuantity(Number(event.target.value))
                        })}
                      />
                    </label>
                    <label className="admin-pack-default">
                      <input
                        checked={assignment.selectedByDefault}
                        onChange={(event) => updateAssignment(assignment.productId, { selectedByDefault: event.target.checked })}
                        type="checkbox"
                      />
                      <span>Buy All</span>
                    </label>
                    <button className="button icon-button danger" onClick={() => removeProduct(assignment.productId)} type="button">
                      <Trash2 size={16} aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No products are assigned to this pack yet.</p>
          )}
        </div>
      </div>

      <div className="admin-pack-save-row">
        <button className="button primary" disabled={saveState.status === "saving"} onClick={savePack} type="button">
          <Save size={16} aria-hidden="true" />
          <span>{saveState.status === "saving" ? "Saving..." : "Save changes"}</span>
        </button>
        {saveState.message ? (
          <p className={saveState.status === "error" ? "form-error" : "form-success"}>{saveState.message}</p>
        ) : null}
      </div>
    </section>
  );
}

function ProductLabel({ product }: { product: PackAdminProduct }) {
  return (
    <div className="admin-pack-product-copy">
      <strong>{product.name}</strong>
      <span>{[product.brand, product.category ?? "Uncategorized"].filter(Boolean).join(" / ")}</span>
    </div>
  );
}

function dedupeAssignments(assignments: PackAdminAssignment[]) {
  return Array.from(new Map(assignments.map((assignment) => [assignment.productId, assignment])).values())
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10, Math.floor(value)));
}
