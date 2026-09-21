import { notFound } from "next/navigation";
import Link from "next/link";
import { BuildPhotoCarousel, type BuildPhoto } from "@/components/BuildPhotoCarousel";
import { FitmentCreditsCheckoutButton } from "@/app/account/FitmentCreditsCheckoutButton";
import { formatBuildTitle } from "@/lib/buildDisplay";
import { getReviewedBuildSummary } from "@/lib/buildSummary";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv } from "@/lib/supabase/server";
import type { VerifiedBuild } from "@/lib/types";
import { mapVerifiedBuildPreview, previewBuildDetailSelect, type VerifiedBuildPreview } from "@/lib/verifiedBuildAccess";

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseServerEnv()) notFound();

  const { id } = await params;
  const entitlement = await getFitmentEntitlementForCurrentUser();
  const supabase = createSupabaseAdminClient();
  if (!entitlement.canViewPremiumBuilds) {
    const { data: previewBuild } = await supabase
      .from("verified_build_previews")
      .select(previewBuildDetailSelect)
      .eq("id", id)
      .single();

    if (!previewBuild) notFound();
    const sanitizedPreviewBuild = mapVerifiedBuildPreview(previewBuild as VerifiedBuildPreview);
    const photo = sanitizedPreviewBuild.verified_build_photos?.[0] ?? null;
    const title = `${sanitizedPreviewBuild.year} ${sanitizedPreviewBuild.make} ${sanitizedPreviewBuild.model}`;

    return (
      <section className="band">
        <div className="section page-head center">
          <p className="eyebrow">Premium Verified Build</p>
          <h1>{title}</h1>
          <p className="lead">Premium Verified Builds access is needed to view the setup details, notes, and photo gallery.</p>
          <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
            {photo ? (
              <div className="build-card-image-frame build-lock-preview-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="build-card-image-bg" src={photo.url} alt="" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="build-card-image-main" src={photo.url} alt={photo.alt_text ?? title} />
              </div>
            ) : null}
            <h2 style={{ marginTop: 16 }}>Unlock this build</h2>
            <div className="locked-build-labels" aria-label="Locked build details">
              {["Wheel specs", "Tire specs", "Lift", "Rubbing", "Trimming", "Full photo gallery"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <p className="muted">$14 one-time gets two more fitment checks and unlocks the verified builds library.</p>
            <div className="actions" style={{ justifyContent: "center" }}>
              <FitmentCreditsCheckoutButton label="Unlock it" className="button primary" />
              <Link className="button" href="/builds">Back to Builds Preview</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { data: build } = await supabase
    .from("verified_builds")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (!build) notFound();

  const { data: photos } = await supabase
    .from("verified_build_photos")
    .select("id, url, alt_text")
    .eq("build_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const typedBuild = build as VerifiedBuild;
  const title = formatBuildTitle(typedBuild);
  const buildSummary = getReviewedBuildSummary(typedBuild);

  return (
    <section className="band">
      <div className="section build-detail-layout">
        <BuildPhotoCarousel photos={(photos ?? []) as BuildPhoto[]} title={title} />
        <div className="build-detail-content">
          <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
          <h1 className="build-detail-title">{title}</h1>
          <div className="build-story">
            <p>{buildSummary}</p>
          </div>
          <div className="view-full-build">
            <Link className="button" href={`/builds/${id}/full`}>View full build</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
