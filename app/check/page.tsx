import { FitmentForm } from "./FitmentForm";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import { getFreeFitmentCheckQuota } from "@/lib/freeFitmentChecks";
import { getVehicleOptions } from "@/lib/vehicleOptions.server";

export const dynamic = "force-dynamic";

export default async function CheckPage() {
  const entitlement = await getFitmentEntitlementForCurrentUser();
  const purchased = entitlement.canRunPremiumCheck || entitlement.premiumBuildAccess;
  const [vehicleOptions, freeChecks] = await Promise.all([
    getVehicleOptions(),
    getFreeFitmentCheckQuota({ purchased })
  ]);

  return (
    <div className="section verify-page">
      <section className="verify-intro">
        <h1>Check Your Fitment Before You Build</h1>
        <p className="verify-tagline">
          Tell us about your truck and what you have in mind. Driveline reads it and returns a plain-English report on
          rubbing, trimming, clearance, and daily drivability.
        </p>
      </section>

      <FitmentForm entitlement={entitlement} freeChecks={freeChecks} vehicleOptions={vehicleOptions} />
    </div>
  );
}
