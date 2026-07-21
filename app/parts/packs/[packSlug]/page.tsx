import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivePackBySlug } from "@/lib/packs";
import { PackCheckoutSelector } from "./PackCheckoutSelector";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const packGreetingBySlug: Record<string, string> = {
  appearance: "Get everything you need to upgrade your truck’s style with the Appearance Pack.",
  advanced: "Advanced Tacoma upgrades for experienced builders.",
  lighting: "Light up the trail and improve nighttime visibility with the Lighting Pack.",
  recovery: "Be ready when the trail gets difficult with the essential gear in the Recovery Pack.",
  storage: "Keep your gear secure, organized, and easy to reach with the Storage Pack."
};

const advancedPackWarning =
  "Advanced installation required: These products may require custom mounting, wiring, trimming, fabrication, or other significant modifications. They are not beginner-friendly bolt-on upgrades.";

export default async function PartPackPage({ params }: { params: Promise<{ packSlug: string }> }) {
  const { packSlug } = await params;
  const packResult = await getActivePackBySlug(packSlug);

  if (packResult.status === "error") {
    return <PackLoadError />;
  }

  if (packResult.status === "not_found") {
    notFound();
  }

  const pack = packResult.pack;

  const packProducts = pack.products;

  return (
    <section className="band">
      <div className="section">
        <div className="pack-page-head">
          <div>
            <p className="eyebrow">Starter Pack</p>
            <h1>{pack.name}</h1>
            {packGreetingBySlug[pack.slug] ? <p className="pack-greeting">{packGreetingBySlug[pack.slug]}</p> : null}
            {pack.slug === "advanced" ? <p className="advanced-pack-warning">{advancedPackWarning}</p> : null}
            <p className="lead">{pack.description}</p>
            <p className="muted">{packProducts.length} {packProducts.length === 1 ? "product" : "products"} available</p>
          </div>
          <div className="pack-page-actions">
            <Link className="button" href="/parts">Back to all parts</Link>
          </div>
        </div>

        <PackCheckoutSelector packSlug={pack.slug} products={packProducts} />
      </div>
    </section>
  );
}

function PackLoadError() {
  return (
    <section className="band">
      <div className="section">
        <div className="pack-empty-state">
          <h1>Pack products could not load.</h1>
          <p className="muted">This looks temporary. Please refresh in a moment.</p>
          <Link className="button" href="/parts">Back to all parts</Link>
        </div>
      </div>
    </section>
  );
}
