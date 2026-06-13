import Link from "next/link";

export default function CancelPage() {
  return (
    <section className="band">
      <div className="section page-head center">
        <p className="eyebrow">Checkout canceled</p>
        <h1>No changes were made.</h1>
        <p className="lead">You can return to pricing whenever you are ready.</p>
        <div className="actions" style={{ justifyContent: "center" }}><Link className="button primary" href="/pricing">Back to Pricing</Link></div>
      </div>
    </section>
  );
}
