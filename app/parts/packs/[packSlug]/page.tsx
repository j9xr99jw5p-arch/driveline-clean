import Link from "next/link";
import { notFound } from "next/navigation";
import { PartCatalogCard } from "@/app/parts/PartsGrid";
import { getPartPack, partPacks, productMatchesPartPack } from "@/lib/partPackConfig";
import { getPartsCatalog } from "@/lib/partsCatalog";
import { getStoragePackProducts } from "@/lib/storagePackProducts";
import { BuyAllPackButton } from "./BuyAllPackButton";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return partPacks.map((pack) => ({ packSlug: pack.slug }));
}

export default async function PartPackPage({ params }: { params: Promise<{ packSlug: string }> }) {
  const { packSlug } = await params;
  const pack = getPartPack(packSlug);
  if (!pack) notFound();

  const storagePack = pack.slug === "storage" ? await getStoragePackProducts() : null;
  const { products } = storagePack ?? (await getPartsCatalog());
  const packProducts = storagePack ? products : products.filter((product) => productMatchesPartPack(product, pack));

  return (
    <section className="band">
      <div className="section">
        <div className="pack-page-head">
          <div>
            <p className="eyebrow">Starter Pack</p>
            <h1>{pack.title}</h1>
            <p className="lead">{pack.description}</p>
            <p className="muted">{packProducts.length} {packProducts.length === 1 ? "product" : "products"} available</p>
          </div>
          <div className="pack-page-actions">
            <BuyAllPackButton packSlug={pack.slug} productIds={packProducts.map((product) => product.id)} />
            <Link className="button" href="/parts">Back to all parts</Link>
          </div>
        </div>

        {storagePack?.error ? (
          <div className="pack-empty-state">
            <h2>We could not load the Storage Pack.</h2>
            <p className="muted">Please try again in a moment.</p>
          </div>
        ) : packProducts.length ? (
          <div className="grid three">
            {packProducts.map((product) => <PartCatalogCard product={product} key={product.id} />)}
          </div>
        ) : (
          <div className="pack-empty-state">
            <h2>{pack.slug === "storage" ? "No storage products are currently available." : "No matching parts yet."}</h2>
            {pack.slug === "storage" ? null : (
              <p className="muted">Add products in these categories to populate this pack: {pack.categories.join(", ")}.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
