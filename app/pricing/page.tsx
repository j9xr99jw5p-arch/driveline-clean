import { Check } from "lucide-react";
import { plans } from "@/lib/plans";
import { CheckoutButton } from "./CheckoutButton";

export default function PricingPage() {
  return (
    <section className="band alt">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Pricing</p>
          <h1>Three Full Checks Free. More for $14.</h1>
          <p className="lead">Every check is the full report, including verified-build matches. You only pay when you want to run it again.</p>
        </div>
        <div className="detail-grid" style={{ marginBottom: 28 }}>
          <div className="detail-field"><span>Free</span><strong>3 full fitment checks</strong></div>
          <div className="detail-field"><span>Then</span><strong>$14 one-time for 2 more checks</strong></div>
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
            <div className="detail-field"><span>Free checks</span><strong>Capped at 3 full reports</strong></div>
            <div className="detail-field"><span>Paid checks</span><strong>$14 adds 2 more full reports and the verified builds library</strong></div>
            <div className="detail-field"><span>Account</span><strong>Sign in before checkout so extra checks land on your account</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
