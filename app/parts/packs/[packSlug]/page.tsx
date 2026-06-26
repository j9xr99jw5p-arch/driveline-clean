import Link from "next/link";
import { notFound } from "next/navigation";
import { PartCatalogCard } from "@/app/parts/PartsGrid";
import { getPartPack, partPacks, productMatchesPartPack } from "@/lib/partPackConfig";
import { getPartsCatalog } from "@/lib/partsCatalog";
import { BuyAllPackButton } from "./BuyAllPackButton";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return partPacks.map((pack) => ({ packSlug: pack.slug }));
}

export default async function PartPackPage({ params }: { params: Promise<{ packSlug: string }> }) {
  const { packSlug } = await params;
  const pack = getPartPack(packSlug);
  if (!pack) notFound();

  const { products } = await getPartsCatalog();
  const packProducts = products.filter((product) => productMatchesPartPack(product, pack));

  return (
    <section className="band">
      <div className="section">
        <div className="pack-page-head">
          <div>
            <p className="eyebrow">Starter Pack</p>
            <h1>{pack.title}</h1>
            <p className="lead">{pack.description}</p>
          </div>
          <div className="pack-page-actions">
            <BuyAllPackButton packSlug={pack.slug} productIds={packProducts.map((product) => product.id)} />
            <Link className="button" href="/parts">Back to all parts</Link>
          </div>
        </div>

        {packProducts.length ? (
          <div className="grid three">
            {packProducts.map((product) => <PartCatalogCard product={product} key={product.id} />)}
          </div>
        ) : (
          <div className="pack-empty-state">
            <h2>No matching parts yet.</h2>
            <p className="muted">Add products in these categories to populate this pack: {pack.categories.join(", ")}.</p>
          </div>
        )}
      </div>
    </section>
  );
}
