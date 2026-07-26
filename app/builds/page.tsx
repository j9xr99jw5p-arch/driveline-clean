import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import type { VerifiedBuild } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv } from "@/lib/supabase/server";
import { mapVerifiedBuildPreview, premiumBuildListSelect, previewBuildListSelect, type VerifiedBuildPreview } from "@/lib/verifiedBuildAccess";
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

  const supabase = createSupabaseAdminClient();
  const entitlement = await getFitmentEntitlementForCurrentUser();
  const hasPremiumAccess = entitlement.canViewPremiumBuilds;
  const buildsResult = hasPremiumAccess
    ? await supabase
      .from("verified_builds")
      .select(premiumBuildListSelect)
      .eq("published", true)
      .order("created_at", { ascending: false })
    : await supabase
      .from("verified_build_previews")
      .select(previewBuildListSelect)
      .order("year", { ascending: false });
  const builds = hasPremiumAccess
    ? buildsResult.data
    : (buildsResult.data ?? []).map((build) => mapVerifiedBuildPreview(build as VerifiedBuildPreview));

  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Driveline Verified Builds</p>
          <h1>Verified Tacoma Builds</h1>
          <p className="lead">{hasPremiumAccess
            ? "Review real-world Tacoma wheel, tire, lift, rubbing, trimming, and drivability outcomes from published builds."
            : "Preview real-world Tacoma builds."}</p>
        </div>
        {hasPremiumAccess ? <p className="risk-definition-note">
          Risk labels are based on real-world clearance needs. Low risk means little to no trimming or rubbing.
          Medium risk usually means some trimming and possible minor rubbing. High risk means the setup needs
          major trimming, custom clearance work, or other modifications to run properly.
        </p> : null}
        {(builds ?? []).length ? (
          <BuildsGrid builds={builds as unknown as VerifiedBuild[]} locked={!hasPremiumAccess} />
        ) : (
          <div className="card" style={{ marginTop: 28 }}><h2>No published builds yet.</h2><p className="muted">We couldn’t load this information right now. Please try again shortly.</p></div>
        )}
      </div>
    </section>
  );
}
