import { Check } from "lucide-react";
import { plans } from "@/lib/plans";
import { CheckoutButton } from "./CheckoutButton";

export default function PricingPage() {
  return (
    <section className="band alt">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Pricing</p>
          <h1>Check Free. Go Deeper for $14.</h1>
          <p className="lead">Three basic fitment checks are included. When you want the full report, it is a one-time $14 charge — no monthly subscription.</p>
        </div>
        <div className="detail-grid" style={{ marginBottom: 28 }}>
          <div className="detail-field"><span>Free</span><strong>3 basic fitment checks</strong></div>
          <div className="detail-field"><span>Premium</span><strong>$14 one-time for 2 full reports</strong></div>
        </div>
        <div className="pricing-grid" style={{ marginTop: 28 }}>
          {plans.map((plan) => (
            <div className={`card pricing-card ${plan.key === "premium" ? "featured" : ""}`} key={plan.key}>
              {plan.key === "premium" ? <div className="badge">One-time</div> : null}
              <h2>{plan.name}</h2>
              <p className="muted">{plan.description}</p>
              <div className="price">{plan.price}<span>{plan.interval}</span></div>
              <div className="feature-list">
                {plan.features.map((feature) => (
                  <div className="feature-item" key={feature}><Check size={18} /><span>{feature}</span></div>
                ))}
              </div>
              <div>{plan.key === "free" ? <a className="button full" href="/check">Start Free</a> : <CheckoutButton />}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 32 }}>
          <p className="eyebrow">Billing Notes</p>
          <h2>The $14 charge is one-time.</h2>
          <div className="detail-grid">
            <div className="detail-field"><span>Free checks</span><strong>Capped at 3 basic reports</strong></div>
            <div className="detail-field"><span>Premium</span><strong>$14 unlocks 2 full AI reports and Verified Builds access</strong></div>
            <div className="detail-field"><span>Account</span><strong>Sign in before checkout so the reports land on your account</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
