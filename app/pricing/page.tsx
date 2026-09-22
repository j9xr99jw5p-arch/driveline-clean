import { Check } from "lucide-react";
import { FREE_STARTING_CREDITS } from "@/lib/creditPacks";
import { plans } from "@/lib/plans";
import { CheckoutButton } from "./CheckoutButton";

export default function PricingPage() {
  return (
    <section className="band alt">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Pricing</p>
          <h1>{FREE_STARTING_CREDITS} Free Credits. Buy More When You Need Them.</h1>
          <p className="lead">Every check spends credits based on photos and mods. You only pay when you want more credits.</p>
        </div>
        <div className="detail-grid" style={{ marginBottom: 28 }}>
          <div className="detail-field"><span>Free</span><strong>{FREE_STARTING_CREDITS} credits to start</strong></div>
          <div className="detail-field"><span>Then</span><strong>$4.99 / $14.99 packs, or $25/month Priority</strong></div>
        </div>
        <div className="pricing-grid" style={{ marginTop: 28 }}>
          {plans.map((plan) => (
            <div className={`card pricing-card ${plan.key === "priority" ? "featured" : ""}`} key={plan.key}>
              {plan.key === "priority" ? <div className="badge">Monthly</div> : plan.pack ? <div className="badge">One-time</div> : null}
              <h2>{plan.name}</h2>
              <p className="muted">{plan.description}</p>
              <div className="price">{plan.price}<span>{plan.interval}</span></div>
              <div className="feature-list">
                {plan.features.map((feature) => (
                  <div className="feature-item" key={feature}><Check size={18} /><span>{feature}</span></div>
                ))}
              </div>
              <div>
                {plan.pack ? (
                  <CheckoutButton pack={plan.pack} label={`${plan.price}${plan.interval}`} />
                ) : (
                  <a className="button full" href="/check">Start Free</a>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 32 }}>
          <p className="eyebrow">Billing Notes</p>
          <h2>Credits are one-time packs or a monthly Priority plan.</h2>
          <div className="detail-grid">
            <div className="detail-field"><span>Free credits</span><strong>{FREE_STARTING_CREDITS} when you sign in</strong></div>
            <div className="detail-field"><span>Credit packs</span><strong>$4.99 for 50, $14.99 for 150</strong></div>
            <div className="detail-field"><span>Priority</span><strong>$25/month for 250 credits and priority service</strong></div>
            <div className="detail-field"><span>Account</span><strong>Sign in before checkout so credits land on your account</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
