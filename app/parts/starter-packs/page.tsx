import { getStarterPacks } from "@/lib/starterPacks";
import { StarterPackCheckout } from "./StarterPackCheckout";

export const dynamic = "force-dynamic";

export default async function StarterPacksPage() {
  const packs = await getStarterPacks();

  return (
    <section className="band">
      <div className="section">
        <StarterPackCheckout packs={packs} />
      </div>
    </section>
  );
}
