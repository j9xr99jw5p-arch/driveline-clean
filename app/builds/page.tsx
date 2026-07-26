import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import Link from "next/link";
import type { VerifiedBuild } from "@/lib/types";
import { premiumBuildListSelect, previewBuildListSelect, sanitizeVerifiedBuildPreview } from "@/lib/verifiedBuildAccess";
import { BuildsGrid } from "./BuildsGrid";

export default async function BuildsPage() {
  if (!hasSupabaseServerEnv()) {
    return (
      <section className="band">
        <div className="section">
          <div className="page-head center">
            <p className="eyebrow">Driveline Verified Builds</p>
            <h1>Verified Tacoma Builds</h1>
            <p className="lead">Something went wrong while loading this page. We’re working to fix it. Please refresh or try again shortly.</p>
          </div>
          <div className="card" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <h2>Builds are temporarily unavailable.</h2>
            <p className="muted">We couldn’t load this information right now. Please try again shortly.</p>
          </div>
        </div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const entitlement = await getFitmentEntitlementForCurrentUser();
  const hasPremiumAccess = entitlement.canViewPremiumBuilds;
  const buildsResult = hasPremiumAccess
    ? await supabase
      .from("verified_builds")
      .select(premiumBuildListSelect)
      .eq("published", true)
      .order("created_at", { ascending: false })
    : await supabase
      .from("verified_builds")
      .select(previewBuildListSelect)
      .eq("published", true)
      .order("created_at", { ascending: false });
  const builds = hasPremiumAccess
    ? buildsResult.data
    : (buildsResult.data ?? []).map((build) => sanitizeVerifiedBuildPreview(build as Partial<VerifiedBuild>));

  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Driveline Verified Builds</p>
          <h1>Verified Tacoma Builds</h1>
          <p className="lead">{hasPremiumAccess
            ? "Review real-world Tacoma wheel, tire, lift, rubbing, trimming, and drivability outcomes from published builds."
            : "Preview real-world Tacoma fitment data. Full setup details are included with the $14 premium fitment-check purchase."}</p>
        </div>
        {!hasPremiumAccess ? (
          <div className="card" style={{ margin: "0 auto 28px", maxWidth: 860, textAlign: "center" }}>
            <p className="eyebrow">Premium Verified Builds</p>
            <h2>Included with the $14 one-time premium check purchase.</h2>
            <p className="muted">The current $14 one-time premium check purchase includes Verified Builds access. No recurring subscription is required.</p>
            <div className="actions" style={{ justifyContent: "center" }}>
              <Link className="button primary" href="/check">Get 2 Premium Checks</Link>
              <Link className="button" href="/submit-build">Submit a Build</Link>
            </div>
          </div>
        ) : null}
        <p className="risk-definition-note">
          Risk labels are based on real-world clearance needs. Low risk means little to no trimming or rubbing.
          Medium risk usually means some trimming and possible minor rubbing. High risk means the setup needs
          major trimming, custom clearance work, or other modifications to run properly.
        </p>
        {(builds ?? []).length ? (
          <BuildsGrid builds={builds as unknown as VerifiedBuild[]} locked={!hasPremiumAccess} />
        ) : (
          <div className="card" style={{ marginTop: 28 }}><h2>No published builds yet.</h2><p className="muted">We couldn’t load this information right now. Please try again shortly.</p></div>
        )}
      </div>
    </section>
  );
}
