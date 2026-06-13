"use client";

import { useState } from "react";

const friendlyCheckoutError =
  "We’re having trouble opening checkout right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

export function CheckoutButton({ plan }: { plan: "builder" }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter your email address to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const captureResponse = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, source: "pricing", plan })
      });

      if (!captureResponse.ok) {
        const payload = await captureResponse.json().catch((error) => {
          console.error("Email capture error response could not be read", error);
          return {};
        });
        console.error("Email capture failed before checkout", {
          status: captureResponse.status,
          statusText: captureResponse.statusText,
          payload
        });
      }
    } catch (error) {
      console.error("Email capture request failed before checkout", error);
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email: normalizedEmail })
      });
      const payload = await response.json().catch((error) => {
        console.error("Checkout response could not be read", error);
        return {};
      });
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      console.error("Checkout request failed", payload);
      setError(payload.error ?? friendlyCheckoutError);
    } catch (error) {
      console.error("Checkout request failed", error);
      setError(friendlyCheckoutError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <label className="field">
        <span>Email for checkout</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      <button className="button primary full" type="button" disabled={loading} onClick={checkout}>
        {loading ? "Opening checkout..." : "Start Builder Plus"}
      </button>
      {error ? <p className="fine" style={{ marginTop: 10 }}>{error}</p> : null}
    </div>
  );
}
