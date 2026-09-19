"use client";

import { useState } from "react";

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

export function CheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/fitment-credits", { method: "POST" });
      const payload = await response.json().catch((readError) => {
        console.error("Checkout response could not be read", readError);
        return {};
      });

      if (payload.url) {
        window.location.href = payload.url;
        return;
      }

      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }

      console.error("Checkout request failed", payload);
      setError(payload.error ?? friendlyCheckoutError);
    } catch (requestError) {
      console.error("Checkout request failed", requestError);
      setError(friendlyCheckoutError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button primary full" type="button" disabled={loading} onClick={checkout}>
        {loading ? "Opening checkout..." : "Get 2 Premium Checks — $14"}
      </button>
      {error ? <p className="fine" style={{ marginTop: 10 }}>{error}</p> : null}
    </div>
  );
}
