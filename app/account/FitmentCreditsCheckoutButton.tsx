"use client";

import { useState } from "react";
import type { CreditPackKey } from "@/lib/creditPacks";

export function FitmentCreditsCheckoutButton({
  label = "Get 150 credits — $14.99",
  pack = "credits_150",
  className = "button primary full"
}: {
  label?: string;
  pack?: CreditPackKey;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/fitment-credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack })
      });
      const payload = await response.json();

      if (!response.ok || !payload?.url) {
        if (payload?.redirectUrl) {
          window.location.assign(payload.redirectUrl);
          return;
        }

        throw new Error(payload?.error ?? "We’re having trouble opening checkout right now.");
      }

      window.location.assign(payload.url);
    } catch (requestError) {
      console.error("Fitment credits checkout failed", requestError);
      setError(requestError instanceof Error ? requestError.message : "We’re having trouble opening checkout right now.");
      setLoading(false);
    }
  }

  return (
    <>
      <button className={className} type="button" disabled={loading} onClick={checkout}>
        {loading ? "Opening checkout..." : label}
      </button>
      {error ? <p className="fine" style={{ marginTop: 10 }}>{error}</p> : null}
    </>
  );
}
