import Link from "next/link";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const params = await searchParams;
  const isFitmentPurchase = params.purchase === "fitment-credits";
  const entitlement = isFitmentPurchase ? await getFitmentEntitlementForCurrentUser() : null;
  const entitlementConfirmed = Boolean(entitlement?.isAuthenticated && entitlement.canViewPremiumBuilds);

  return (
    <section className="band">
      <div className="section page-head center">
        <p className="eyebrow">{isFitmentPurchase ? "Payment received" : "Subscription Confirmed"}</p>
        <h1>{isFitmentPurchase ? "Your credits are being confirmed" : "You&apos;re subscribed"}</h1>
        <p className="lead">{isFitmentPurchase
          ? entitlementConfirmed
            ? `Your account currently has ${entitlement?.spendableCredits ?? 0} credits${entitlement?.priority ? " and Priority service" : ""}.`
            : "Stripe is confirming your purchase. Credits are granted by the secure webhook, not by this page."
          : "Your Driveline Auto subscription is active."}</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <Link className="button primary" href="/check">Start a Fitment Check</Link>
          <Link className="button" href="/account">Go to Account</Link>
        </div>
        <p className="fine" style={{ marginTop: 20 }}>{isFitmentPurchase
          ? "If access does not appear immediately, check your account again in a moment. The account page reads the server-side entitlement record."
          : "You should receive a confirmation email shortly. Billing can be managed from your account page."}</p>
      </div>
    </section>
  );
}
