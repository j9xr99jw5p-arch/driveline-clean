import { getPartsCatalog } from "@/lib/partsCatalog";
import { PartsGrid } from "./PartsGrid";

export const dynamic = "force-dynamic";

export default async function PartsPage() {
  const { products, categories } = await getPartsCatalog();

  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Driveline Parts</p>
          <h1>Browse Parts</h1>
          <p className="lead">Find parts used on verified Tacoma builds, then open each part to see the builds running it.</p>
        </div>
        <PartsGrid products={products} categories={categories} />
      </div>
    </section>
  );
}
