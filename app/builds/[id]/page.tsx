import { notFound } from "next/navigation";
import { BuildPhotoCarousel, type BuildPhoto } from "@/components/BuildPhotoCarousel";
import { cleanJoin, formatBoolean, formatBuildTitle, formatSuspension, formatWheelTireCombo } from "@/lib/buildDisplay";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import type { VerifiedBuild } from "@/lib/types";

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseServerEnv()) notFound();

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
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

  return (
    <section className="band">
      <div className="section build-detail-layout">
        <BuildPhotoCarousel photos={(photos ?? []) as BuildPhoto[]} title={title} />
        <div className="build-detail-content">
          <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
          <h1 className="build-detail-title">{title}</h1>
          <div className="card build-detail-card">
            <div className="detail-grid">
              {[
              ["Wheel / tire", formatWheelTireCombo(typedBuild)],
              ["Suspension", formatSuspension(typedBuild)],
              ["Cab / Bed", cleanJoin([typedBuild.cab, typedBuild.bed], " / ")],
              ["Rubbing", typedBuild.rubbing_severity],
              ["Trimming", formatBoolean(typedBuild.trimming_required)],
              ["Body mount chop", formatBoolean(typedBuild.body_mount_chop)],
              ["Owner / source", typedBuild.owner_name ?? typedBuild.source_url]
              ].map(([label, value]) => (
                <div className="detail-field" key={label}><span>{label}</span><strong>{value || "Unknown"}</strong></div>
              ))}
            </div>
          </div>
          {build.notes ? <p className="lead" style={{ marginTop: 20 }}>{build.notes}</p> : null}
        </div>
      </div>
    </section>
  );
}
