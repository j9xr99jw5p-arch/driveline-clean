import { getVehicleOptions } from "@/lib/vehicleOptions.server";
import { SubmitBuildForm } from "./SubmitBuildForm";

export const revalidate = 86400;

export default async function SubmitBuildPage({
  searchParams
}: {
  searchParams: Promise<{ year?: string; make?: string; model?: string }>;
}) {
  const [vehicleOptions, params] = await Promise.all([getVehicleOptions(), searchParams]);
  const initialVehicle = {
    year: params.year?.trim() ?? "",
    make: params.make?.trim() ?? "",
    model: params.model?.trim() ?? ""
  };

  return (
    <div className="section verify-page">
      <section className="verify-intro">
        <h1>Get Your Build Verified by Driveline</h1>
        <p className="verify-tagline">
          Tell us about your truck and we’ll review it, verify the fitment details, and turn it into a verified Driveline build.
        </p>
      </section>

      <SubmitBuildForm
        vehicleOptions={vehicleOptions}
        initialVehicle={initialVehicle.year || initialVehicle.make || initialVehicle.model ? initialVehicle : undefined}
      />
    </div>
  );
}
