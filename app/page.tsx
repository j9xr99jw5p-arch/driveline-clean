import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, Search } from "lucide-react";
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
  const featuredTitle = featuredBuild ? `${featuredBuild.year} ${featuredBuild.make} ${featuredBuild.model}` : "";

  return (
    <>
      <section className="hero">
        <div className="section homepage-hero">
          <div className="homepage-hero-copy">
            <p className="eyebrow">Driveline Fitment Data</p>
            <h1>Know What Fits Before You Buy.</h1>
            <p className="lead">
              Check your wheel, tire, and suspension setup, then compare it with real-world trucks that have already run similar fitment.
            </p>
            <div className="actions">
              <Link className="button primary" href="/check">Check My Fitment <ArrowRight size={18} /></Link>
              <Link className="button" href="/builds">Browse Verified Builds</Link>
            </div>
            <p className="fine homepage-hero-note">Built from real setups, owner reports, and fitment data.</p>
          </div>
        </div>
      </section>

      <section className="band alt">
        <div className="section">
          <div className="page-head center">
            <p className="eyebrow">Core Tools</p>
            <h2>Two ways to make a smarter fitment decision.</h2>
          </div>
          <div className="homepage-tool-grid">
            <article className="card homepage-tool-card">
              <div className="homepage-tool-icon"><Search size={24} /></div>
              <h3>Fitment Checker</h3>
              <p className="muted">
                Enter your truck, wheel, tire, offset, and suspension information to receive a practical fitment risk assessment.
              </p>
              <ul className="homepage-check-list">
                <li>Wheel and tire compatibility</li>
                <li>Rubbing and clearance risk</li>
                <li>Likely trimming or body-mount modifications</li>
                <li>Practical setup recommendations</li>
              </ul>
              <Link className="button primary full" href="/check">Run a Fitment Check</Link>
            </article>

            <article className="card homepage-tool-card">
              <div className="homepage-tool-icon"><Database size={24} /></div>
              <h3>Verified Builds</h3>
              <p className="muted">
                Browse real truck setups with documented wheel specs, tire sizes, suspension details, rubbing reports, trimming notes, and photos.
              </p>
              <ul className="homepage-check-list">
                <li>Real-world truck configurations</li>
                <li>Owner- and shop-reported fitment notes</li>
                <li>Photos of completed setups</li>
                <li>Searchable comparison data</li>
              </ul>
              <Link className="button primary full" href="/builds">Explore Verified Builds</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="section">
          <div className="page-head center">
            <p className="eyebrow">How It Works</p>
            <h2>From setup idea to real-world comparison.</h2>
          </div>
          <div className="homepage-steps" aria-label="How Driveline works">
            <article className="homepage-step">
              <span>1</span>
              <h3>Enter your setup</h3>
              <p className="muted">Add the truck, tire size, wheel size, offset, lift height, and clearance details you know.</p>
            </article>
            <article className="homepage-step">
              <span>2</span>
              <h3>Review the fitment report</h3>
              <p className="muted">See rubbing risk, likely clearance work, and setup notes before you commit.</p>
            </article>
            <article className="homepage-step">
              <span>3</span>
              <h3>Compare it with real builds</h3>
              <p className="muted">Use verified trucks to understand what owners actually ran and what changed.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="band alt">
        <div className="section homepage-data-section">
          <div className="homepage-data-copy">
            <p className="eyebrow">Verified Build Data</p>
            <h2>Fitment Data From Trucks That Actually Exist</h2>
            <p className="lead">
              Online fitment advice is often based on guesses, incomplete forum posts, or ideal measurements. Driveline organizes real setups so you can see what owners actually ran, what rubbed, and what modifications were required.
            </p>
            <Link className="button primary" href="/builds">See Real Setups</Link>
          </div>

          {featuredBuild && featuredPhoto ? (
            <article className="featured-build-card homepage-featured-build">
              <div className="featured-build-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featuredPhoto.url} alt={featuredPhoto.alt_text ?? featuredTitle} />
              </div>
              <div className="featured-build-copy">
                <p className="eyebrow">Published Build</p>
                <h3>{featuredTitle}</h3>
                <Link className="button full" href={`/builds/${featuredBuild.id}`}>View Build Details</Link>
              </div>
            </article>
          ) : (
            <div className="spec-panel homepage-featured-build">
              <p className="eyebrow">Published Builds</p>
              <h3>Verified builds are loading in.</h3>
              <p className="muted">Once published builds with photos are available, this space will show one real setup.</p>
              <Link className="button full" href="/builds">Browse Verified Builds</Link>
            </div>
          )}
        </div>
      </section>

      <section className="band">
        <div className="section homepage-contribute">
          <div>
            <p className="eyebrow">Contribute Fitment Data</p>
            <h2>Help Build the Fitment Database</h2>
            <p className="lead">
              Submit your truck’s wheel, tire, suspension, rubbing, and trimming details so other owners can learn from a setup that has already been tested.
            </p>
            <p className="muted">Shops can contribute completed customer builds and receive access to the growing fitment database.</p>
          </div>
          <Link className="button primary" href="/submit-build">Submit Your Build</Link>
        </div>
      </section>

      <section className="band alt homepage-final-cta">
        <div className="section page-head center">
          <p className="eyebrow">Start Here</p>
          <h2>Check the Setup Before You Spend the Money.</h2>
          <div className="actions">
            <Link className="button primary" href="/check">Check My Fitment <CheckCircle2 size={18} /></Link>
            <Link className="button" href="/builds">Browse Real Builds</Link>
          </div>
        </div>
      </section>
    </>
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
