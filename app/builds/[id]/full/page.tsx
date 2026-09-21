import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BuildPhotoCarousel, type BuildPhoto } from "@/components/BuildPhotoCarousel";
import { BuildNotesList } from "@/components/BuildNotesList";
import { cleanJoin, formatBooleanLabel, formatRubbingLabel, formatSuspension, formatWheelTireCombo } from "@/lib/buildDisplay";
import { getPublicSocialHandle, sanitizePublicBuildNotes } from "@/lib/buildPrivacy";
import { getReviewedBuildSummary } from "@/lib/buildSummary";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerEnv } from "@/lib/supabase/server";
import type { VerifiedBuild } from "@/lib/types";

export default async function FullBuildPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseServerEnv()) notFound();

  const { id } = await params;
  const entitlement = await getFitmentEntitlementForCurrentUser();
  if (!entitlement.canViewPremiumBuilds) {
    redirect(`/builds/${id}`);
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: build }, { data: photos }] = await Promise.all([
    supabase.from("verified_builds").select("*").eq("id", id).eq("published", true).single(),
    supabase
      .from("verified_build_photos")
      .select("id, url, alt_text")
      .eq("build_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
  ]);

  if (!build) notFound();

  const typedBuild = build as VerifiedBuild;
  const title = [typedBuild.year, typedBuild.make, typedBuild.model].filter(Boolean).join(" ");
  const socialHandle = getPublicSocialHandle(typedBuild);
  const publicNotes = sanitizePublicBuildNotes(typedBuild.notes);
  const buildSummary = getReviewedBuildSummary(typedBuild);

  return (
    <section className="band">
      <div className="section build-full-layout">
        <div className="build-full-head">
          <Link className="build-full-back" href={`/builds/${id}`}>Back to summary</Link>
          <h1 className="build-detail-title">{title}</h1>
          <span className={`pill ${typedBuild.fitment_risk}`}>{typedBuild.fitment_risk} risk</span>
        </div>
        <BuildPhotoCarousel photos={(photos ?? []) as BuildPhoto[]} title={title} variant="full" />
        <div className="build-story">
          <p>{buildSummary}</p>
        </div>
        <div className="build-facts" aria-label="Full build list">
          {[
            ["Wheel / tire", formatWheelTireCombo(typedBuild)],
            ["Suspension", formatSuspension(typedBuild)],
            ["Cab / Bed", cleanJoin([typedBuild.cab, typedBuild.bed], " / ")],
            ["Rubbing", formatRubbingLabel(typedBuild.rubbing_severity)],
            ["Trimming", formatBooleanLabel(typedBuild.trimming_required)],
            ["Body mount chop", formatBooleanLabel(typedBuild.body_mount_chop)],
            ...(!publicNotes
              ? [
                  ["Lighting", typedBuild.lighting_upgrades],
                  ["Favorite mods", typedBuild.favorite_modifications]
                ] as const
              : []),
            ["Social", socialHandle]
          ].map(([label, value]) => (
            <div className="build-fact" key={label}><span>{label}</span><strong>{value || "Unknown"}</strong></div>
          ))}
        </div>
        <BuildNotesList notes={typedBuild.notes} />
      </div>
    </section>
  );
}
