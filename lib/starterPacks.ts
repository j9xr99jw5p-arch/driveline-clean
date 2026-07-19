import "server-only";
import { getActivePacks, type PackProduct } from "@/lib/packs";
import type { StarterPack, StarterPackProduct } from "@/lib/starterPackTypes";

export async function getStarterPacks(): Promise<StarterPack[]> {
  const packs = await getActivePacks();

  return packs.map((pack) => ({
    slug: pack.slug,
    name: pack.name,
    subtitle: pack.description ?? "",
    description: "Pick the parts you still need, skip the ones you already own, and check out with only the useful upgrades.",
    groups: [
      {
        title: pack.name,
        category: pack.name.replace(" Pack", ""),
        items: [],
        note: pack.description ?? "Select only the parts you still need.",
        products: pack.products.map(mapStarterPackProduct)
      }
    ]
  }));
}

function mapStarterPackProduct(product: PackProduct): StarterPackProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    imageUrl: product.imageUrl,
    priceCents: product.priceCents,
    priceLabel: product.priceLabel,
    priceSource: product.priceSource,
    note: null,
    required: false,
    defaultSelected: product.selectedByDefault,
    recommendedQuantity: product.packQuantity,
    budgetTier: null
  };
}
