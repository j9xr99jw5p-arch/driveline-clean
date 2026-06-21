import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatBuildTitle } from "@/lib/buildDisplay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { VerifiedBuild } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featuredBuild = await getFeaturedBuildOfTheDay();
  const featuredPhoto = featuredBuild?.verified_build_photos?.[0] ?? null;

  return (
    <>
      <section className="hero">
        <div className="section hero-grid">
          <div>
            <p className="eyebrow">Toyota Tacoma Fitment Verifier</p>
            <h1>Stop guessing. Get fitment advice that won’t let you down.</h1>
            <p className="lead">Enter your Tacoma setup and compare it against a curated verified-build library. Driveline calls out rubbing risk, trimming, body mount chop likelihood, and real-world tradeoffs before you buy parts.</p>
            <div className="actions">
              <Link className="button primary" href="/check">Check My Fitment <ArrowRight size={18} /></Link>
              <Link className="button" href="/builds">Browse Verified Builds</Link>
            </div>
          </div>
          <div className="hero-visual">
            {featuredBuild && featuredPhoto ? (
              <article className="featured-build-card">
                <div className="featured-build-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={featuredPhoto.url} alt={featuredPhoto.alt_text ?? formatBuildTitle(featuredBuild)} />
                </div>
                <div className="featured-build-copy">
                  <p className="eyebrow">Featured Build of the Day</p>
                  <h2>{formatBuildTitle(featuredBuild)}</h2>
                  <Link className="button primary full" href={`/builds/${featuredBuild.id}`}>View Full Build</Link>
                </div>
              </article>
            ) : (
              <div className="spec-panel" style={{ width: "min(440px, 100%)" }}>
                <p className="eyebrow">Featured Build of the Day</p>
                <h2>Verified builds are loading in.</h2>
                <p className="muted">Once published builds with photos are available, this space will rotate through one build each day.</p>
                <Link className="button primary full" href="/builds">Browse Verified Builds</Link>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="band alt">
        <div className="section grid three">
          <div className="card feature-card"><ShieldCheck size={24} /><h3>Honest assessments</h3><p className="muted">See rubbing, trimming, clearance, and drivability warnings before money leaves your account.</p></div>
          <div className="card feature-card"><CheckCircle2 size={24} /><h3>Verified build data</h3><p className="muted">Browse real Tacoma setups with tire, wheel, lift, rubbing, and owner/source details.</p></div>
          <div className="card feature-card"><ArrowRight size={24} /><h3>No clutter</h3><p className="muted">Focused on fitment checks, verified builds, submissions, pricing, and account essentials.</p></div>
        </div>
      </section>
    </>
  );
}

async function getFeaturedBuildOfTheDay() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("verified_builds")
      .select("*, verified_build_photos(*)")
      .eq("published", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Homepage featured build query failed:", error);
      return null;
    }

    const buildsWithPhotos = ((data ?? []) as VerifiedBuild[])
      .map((build) => ({
        ...build,
        verified_build_photos: [...(build.verified_build_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      }))
      .filter((build) => (build.verified_build_photos ?? []).length > 0);

    if (!buildsWithPhotos.length) return null;

    const dayIndex = Math.floor(Date.now() / 86_400_000);
    return buildsWithPhotos[dayIndex % buildsWithPhotos.length];
  } catch (error) {
    console.error("Homepage featured build failed:", error);
    return null;
  }
}
