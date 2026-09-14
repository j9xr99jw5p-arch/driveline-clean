import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { previewBuildListSelect, type VerifiedBuildPreview } from "@/lib/verifiedBuildAccess";

export const dynamic = "force-dynamic";

type FeaturedBuildPreview = {
  id: string;
  year: number;
  make: string;
  model: string;
  verified_build_photos?: Array<{
    url: string;
    alt_text: string | null;
  }>;
};

export default async function HomePage() {
  const featuredBuild = await getFeaturedBuildOfTheDay();
  const featuredPhoto = featuredBuild?.verified_build_photos?.[0] ?? null;
  const featuredAlt =
    featuredPhoto?.alt_text ??
    (featuredBuild ? `${featuredBuild.year} ${featuredBuild.make} ${featuredBuild.model}` : "Verified build");

  return (
    <div className="section homepage-minimal">
      <section className="homepage-intro">
        <h1>Build with Confidence</h1>
        <p className="homepage-tagline">
          Use our fitment guidance tool to make smarter decisions when building your truck. Backed by real build setups to help you make better choices for your next build
        </p>
      </section>

      <section className="homepage-build-of-day" aria-labelledby="build-of-the-day-label">
        <p className="homepage-section-label" id="build-of-the-day-label">
          BUILD OF THE DAY
        </p>

        {featuredBuild && featuredPhoto ? (
          <Link className="homepage-build-photo-link" href={`/builds/${featuredBuild.id}`}>
            <div className="homepage-build-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featuredPhoto.url} alt={featuredAlt} />
            </div>
          </Link>
        ) : (
          <div className="homepage-build-photo homepage-build-photo-empty">
            <span>Build photo coming soon</span>
          </div>
        )}

        <Link className="button homepage-cta" href="/builds">
          Browse Builds
        </Link>
      </section>

      <section className="homepage-verified-cta">
        <Link className="button homepage-cta" href="/submit-build">
          Get Verified by Driveline
        </Link>
      </section>
    </div>
  );
}

async function getFeaturedBuildOfTheDay(): Promise<FeaturedBuildPreview | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("verified_build_previews")
      .select(previewBuildListSelect)
      .order("year", { ascending: true });

    if (error) {
      console.error("Homepage featured build query failed:", error);
      return null;
    }

    const buildsWithPhotos = ((data ?? []) as VerifiedBuildPreview[])
      .map((build) => ({
        id: build.id,
        year: build.year,
        make: build.make,
        model: build.model,
        verified_build_photos: build.primary_photo_url
          ? [{ url: build.primary_photo_url, alt_text: build.primary_photo_alt_text }]
          : []
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
