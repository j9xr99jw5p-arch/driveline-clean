import { Check } from "lucide-react";
import { plans } from "@/lib/plans";
import { CheckoutButton } from "./CheckoutButton";

export default function PricingPage() {
  return (
    <section className="band alt">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Pricing</p>
          <h1>Choose Your Plan</h1>
          <p className="lead">Start free. Upgrade to Builder Plus when you want full access to Driveline Auto and every fitment feature.</p>
        </div>
        <div className="detail-grid" style={{ marginBottom: 28 }}>
          <div className="detail-field"><span>Free</span><strong>Browse builds and run a few checks before committing</strong></div>
          <div className="detail-field"><span>Builder Plus</span><strong>Full access to all Driveline features for $12/month</strong></div>
        </div>
        <div className="pricing-grid" style={{ marginTop: 28 }}>
          {plans.map((plan) => (
            <div className={`card pricing-card ${plan.key === "builder" ? "featured" : ""}`} key={plan.key}>
              {plan.key === "builder" ? <div className="badge">Full access</div> : null}
              <h2>{plan.name}</h2>
              <p className="muted">{plan.description}</p>
              <div className="price">{plan.price}<span>{plan.interval}</span></div>
              <div className="feature-list">
                {plan.features.map((feature) => (
                  <div className="feature-item" key={feature}><Check size={18} /><span>{feature}</span></div>
                ))}
              </div>
              <div>{plan.key === "free" ? <a className="button full" href="/check">Start Free</a> : <CheckoutButton plan={plan.key} />}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 32 }}>
          <p className="eyebrow">Billing Notes</p>
          <h2>Checkout and account billing are managed securely.</h2>
          <div className="detail-grid">
            <div className="detail-field"><span>Checkout</span><strong>Builder Plus checkout starts from this page</strong></div>
            <div className="detail-field"><span>Account</span><strong>Active customers can manage billing from the account page</strong></div>
            <div className="detail-field"><span>Limits</span><strong>Your plan automatically tracks fitment check limits</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
