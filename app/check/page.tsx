import { FitmentForm } from "./FitmentForm";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import { getFreeFitmentCheckQuota } from "@/lib/freeFitmentChecks";
import { getVehicleOptions } from "@/lib/vehicleOptions.server";

export const dynamic = "force-dynamic";

export default async function CheckPage() {
  const [entitlement, vehicleOptions, freeChecks] = await Promise.all([
    getFitmentEntitlementForCurrentUser(),
    getVehicleOptions(),
    getFreeFitmentCheckQuota()
  ]);

  return (
    <div className="section verify-page">
      <section className="verify-intro">
        <h1>Check Your Fitment Before You Build</h1>
        <p className="verify-tagline">
          Upload 1 to 3 photos of your truck, tell us what you want done, and we’ll show an estimated look plus a full fitment report matched against verified builds.
        </p>
      </section>

      <FitmentForm entitlement={entitlement} freeChecks={freeChecks} vehicleOptions={vehicleOptions} />
    </div>
  );
}
