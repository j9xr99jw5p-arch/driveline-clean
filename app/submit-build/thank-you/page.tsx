import Link from "next/link";

export default function SubmitBuildThankYouPage() {
  return (
    <div className="section verify-page">
      <section className="verify-intro">
        <h1>Your build is in review.</h1>
        <p className="verify-tagline">
          We received your build and will review the details. Once it’s verified, we’ll create your Driveline build and add it to the verified builds page.
        </p>
      </section>

      <Link className="button verify-submit" href="/builds">
        Browse Builds
      </Link>
    </div>
  );
}
