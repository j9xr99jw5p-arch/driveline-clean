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
        <h1>{isFitmentPurchase ? "Your premium checks are being confirmed" : "You&apos;re subscribed"}</h1>
        <p className="lead">{isFitmentPurchase
          ? entitlementConfirmed
            ? `Your account currently has ${entitlement?.premiumChecksRemaining ?? 0} premium checks remaining and Verified Builds access is active.`
            : "Stripe is confirming your one-time purchase. Premium checks and Verified Builds access are granted by the secure webhook, not by this page."
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
