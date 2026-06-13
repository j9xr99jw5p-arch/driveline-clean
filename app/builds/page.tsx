import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import type { VerifiedBuild } from "@/lib/types";
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
  const { data: builds } = await supabase
    .from("verified_builds")
    .select("*, verified_build_photos(*)")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Driveline Verified Builds</p>
          <h1>Verified Tacoma Builds</h1>
          <p className="lead">Review real-world Tacoma wheel, tire, lift, rubbing, trimming, and drivability outcomes from published builds.</p>
        </div>
        <div className="detail-grid" style={{ marginBottom: 28 }}>
          <div className="detail-field"><span>01 Submitted data</span><strong>Owner-provided wheel, tire, lift, and suspension details</strong></div>
          <div className="detail-field"><span>02 Fitment review</span><strong>Rubbing, trimming, and risk classifications stay visible</strong></div>
          <div className="detail-field"><span>03 Public reference</span><strong>Published builds become a cleaner buying reference</strong></div>
        </div>
        {(builds ?? []).length ? (
          <BuildsGrid builds={builds as VerifiedBuild[]} />
        ) : (
          <div className="card" style={{ marginTop: 28 }}><h2>No published builds yet.</h2><p className="muted">We couldn’t load this information right now. Please try again shortly.</p></div>
        )}
      </div>
    </section>
  );
}
