import Link from "next/link";

export default function CancelPage() {
  return (
    <section className="band">
      <div className="section page-head center">
        <p className="eyebrow">Checkout canceled</p>
        <h1>No changes were made.</h1>
        <p className="lead">You can return to the fitment checker whenever you are ready.</p>
        <div className="actions" style={{ justifyContent: "center" }}><Link className="button primary" href="/check">Start a Fitment Check</Link></div>
      </div>
    </section>
  );
}
