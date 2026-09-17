import { SubmitBuildForm } from "./SubmitBuildForm";

export default function SubmitBuildPage() {
  return (
    <div className="section verify-page">
      <section className="verify-intro">
        <h1>Get Your Build Verified by Driveline</h1>
        <p className="verify-tagline">
          Tell us about your truck and we’ll review it, verify the fitment details, and turn it into a verified Driveline build.
        </p>
      </section>

      <SubmitBuildForm />
    </div>
  );
}
