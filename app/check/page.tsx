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
        <h1>Check Your Fitment</h1>
        <p className="verify-tagline">
          Upload a few photos, describe the build, and get a clear report.
        </p>
      </section>

      <FitmentForm entitlement={entitlement} freeChecks={freeChecks} vehicleOptions={vehicleOptions} />
    </div>
  );
}
