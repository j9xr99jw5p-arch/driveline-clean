import Link from "next/link";

export default function SubmitBuildThankYouPage() {
  return (
    <section className="band">
      <div className="section">
        <div className="card" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <p className="eyebrow">Build Submitted</p>
          <h1>Thanks for your build submission.</h1>
          <p className="lead">
            We received your build details and will review them shortly. If we need anything else, we’ll reach out using the email you provided. Once approved, we’ll create your build card and send it over.
          </p>
          <div className="actions" style={{ justifyContent: "center" }}>
            <Link className="button primary" href="/builds">View Verified Builds</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
