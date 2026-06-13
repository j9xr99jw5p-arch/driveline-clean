"use client";

import { useState } from "react";

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }

      console.error("Billing portal request failed", payload);
      setError("We’re having trouble opening billing right now. We’re working to fix it as quickly as possible. Please try again in a moment.");
    } catch (error) {
      console.error("Billing portal request failed", error);
      setError("We’re having trouble opening billing right now. We’re working to fix it as quickly as possible. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <button className="button primary full" type="button" onClick={openPortal} disabled={loading}>
        {loading ? "Opening..." : "Manage Billing"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}
