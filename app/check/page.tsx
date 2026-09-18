import { FitmentForm } from "./FitmentForm";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import { getVehicleOptions } from "@/lib/vehicleOptions.server";

export const dynamic = "force-dynamic";

export default async function CheckPage() {
  const [entitlement, vehicleOptions] = await Promise.all([
    getFitmentEntitlementForCurrentUser(),
    getVehicleOptions()
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

      <FitmentForm entitlement={entitlement} vehicleOptions={vehicleOptions} />
    </div>
  );
}
