"use client";

import { useState } from "react";

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

export function ProductCheckoutButton({
  variantId,
  buildId,
  label = "Shop these parts",
  disabled
}: {
  variantId: string | null;
  buildId?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);

    try {
      if (!variantId) {
        setError("Please choose an available option first.");
        return;
      }

      const response = await fetch("/api/stripe/create-product-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId, ...(buildId ? { buildId } : {}), quantity: 1 })
      });
      const payload = await response.json().catch((readError) => {
        console.error("Product checkout response could not be read", readError);
        return {};
      });

      if (response.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }

      console.error("Product checkout request failed", {
        status: response.status,
        statusText: response.statusText,
        payload
      });
      setError(payload.error ?? friendlyCheckoutError);
    } catch (requestError) {
      console.error("Product checkout request failed", requestError);
      setError(friendlyCheckoutError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="product-checkout-control">
      <button className="button primary full" type="button" onClick={startCheckout} disabled={loading || disabled || !variantId}>
        {loading ? "Opening checkout..." : label}
      </button>
      {error ? <p className="fine">{error}</p> : null}
    </div>
  );
}
