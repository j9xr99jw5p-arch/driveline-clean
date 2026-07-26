import Link from "next/link";

export default async function CancelPage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const params = await searchParams;
  const isFitmentPurchase = params.purchase === "fitment-credits";

  return (
    <section className="band">
      <div className="section page-head center">
        <p className="eyebrow">Checkout canceled</p>
        <h1>No changes were made.</h1>
        <p className="lead">{isFitmentPurchase
          ? "No premium checks were purchased, and no Verified Builds access was changed."
          : "You can return to the fitment checker whenever you are ready."}</p>
        <div className="actions" style={{ justifyContent: "center" }}><Link className="button primary" href="/check">Start a Fitment Check</Link></div>
      </div>
    </section>
  );
}
