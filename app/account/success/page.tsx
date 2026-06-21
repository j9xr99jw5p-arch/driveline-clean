import Link from "next/link";

export default function AccountSuccessPage() {
  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Account</p>
          <h1>You’re signed in.</h1>
          <p className="lead">Your Driveline account session is active.</p>
        </div>
        <div className="actions" style={{ justifyContent: "center", marginTop: 24 }}>
          <Link className="button primary" href="/account">Go to Account</Link>
          <Link className="button" href="/">Go Home</Link>
        </div>
      </div>
    </section>
  );
}
