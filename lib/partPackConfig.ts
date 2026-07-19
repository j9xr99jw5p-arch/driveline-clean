export type PartPack = {
  slug: string;
  title: string;
  description: string;
  categories: string[];
};

export const partPacks: PartPack[] = [
  {
    slug: "recovery",
    title: "Recovery Pack",
    description: "Basic recovery gear for Tacoma owners who want to be prepared before they get stuck.",
    categories: ["Recovery"]
  },
  {
    slug: "lighting",
    title: "Lighting Pack",
    description: "Simple lighting upgrades that improve visibility without going overboard.",
    categories: ["Lighting"]
  },
  {
    slug: "storage",
    title: "Storage Pack",
    description: "Practical storage and utility parts for keeping gear organized on trips.",
    categories: ["Storage"]
  },
  {
    slug: "appearance",
    title: "Appearance Pack",
    description: "Affordable exterior upgrades that clean up the look of the truck without hurting daily drivability.",
    categories: ["Appearance"]
  }
];

export function getPartPack(slug: string) {
  return partPacks.find((pack) => pack.slug === slug);
}

export function normalizeStarterPackCategory(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function productMatchesPartPack(product: { category: string | null | undefined }, pack: PartPack) {
  const productCategory = normalizeStarterPackCategory(product.category);
  return pack.categories.some((category) => normalizeStarterPackCategory(category) === productCategory);
}
