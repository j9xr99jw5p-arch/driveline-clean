"use client";

import { useState } from "react";

const checkoutErrorMessage = "Pack checkout is having trouble opening right now. Please try again in a moment.";

export function BuyAllPackButton({ packSlug, productIds }: { packSlug: string; productIds: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    if (!productIds.length || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/starter-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_slug: packSlug,
          items: productIds.map((partId) => ({ part_id: partId, quantity: 1 }))
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
      <button className="button primary" disabled={!productIds.length || loading} onClick={checkout} type="button">
        {loading ? "Opening checkout..." : "Buy all"}
      </button>
      {!productIds.length ? <p className="fine">Pack checkout coming soon once matching parts are added.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
