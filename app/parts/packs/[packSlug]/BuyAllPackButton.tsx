"use client";

import { useState } from "react";

const checkoutErrorMessage = "Pack checkout is having trouble opening right now. Please try again in a moment.";

type BuyAllItem = {
  partId: string;
  quantity: number;
};

export function BuyAllPackButton({ packSlug, items }: { packSlug: string; items: BuyAllItem[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    if (!items.length || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/starter-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_slug: packSlug,
          items: items.map((item) => ({ part_id: item.partId, quantity: item.quantity }))
        })
      });
      const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? checkoutErrorMessage);
      }

      window.location.href = data.url;
    } catch (requestError) {
      console.error("Pack checkout failed", requestError);
      setError(requestError instanceof Error ? requestError.message : checkoutErrorMessage);
      setLoading(false);
    }
  }

  return (
    <div className="pack-buy-control">
      <button className="button primary" disabled={!items.length || loading} onClick={checkout} type="button">
        {loading ? "Opening checkout..." : "Buy all"}
      </button>
      {!items.length ? <p className="fine">Pack checkout is available once selected-by-default products are assigned.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
