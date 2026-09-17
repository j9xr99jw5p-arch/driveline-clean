import { getVehicleOptions } from "@/lib/vehicleOptions.server";
import { SubmitBuildForm } from "./SubmitBuildForm";

// Vehicle reference data changes only when the sync-vehicle-options function
// runs, so the rendered page can be cached for a day.
export const revalidate = 86400;

export default async function SubmitBuildPage() {
  const vehicleOptions = await getVehicleOptions();

  return (
    <div className="section verify-page">
      <section className="verify-intro">
        <h1>Get Your Build Verified by Driveline</h1>
        <p className="verify-tagline">
          Tell us about your truck and we’ll review it, verify the fitment details, and turn it into a verified Driveline build.
        </p>
      </section>

      <SubmitBuildForm vehicleOptions={vehicleOptions} />
    </div>
  );
}
