import Link from "next/link";

export default function SuccessPage() {
  return (
    <section className="band">
      <div className="section page-head center">
        <p className="eyebrow">Subscription Confirmed</p>
        <h1>You&apos;re subscribed</h1>
        <p className="lead">Your Driveline Auto subscription is active.</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <Link className="button primary" href="/check">Start a Fitment Check</Link>
          <Link className="button" href="/account">Go to Account</Link>
        </div>
        <p className="fine" style={{ marginTop: 20 }}>You should receive a confirmation email shortly. Billing can be managed from your account page.</p>
      </div>
    </section>
  );
}
