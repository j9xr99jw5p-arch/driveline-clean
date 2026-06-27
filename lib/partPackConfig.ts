import { normalizeProductCategory, type ProductSummary } from "@/lib/products";

export type PartPack = {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  keywords: string[];
  excludeKeywords?: string[];
};

export const partPacks: PartPack[] = [
  {
    slug: "recovery",
    title: "Recovery Pack",
    description: "Basic recovery gear for Tacoma owners who want to be prepared before they get stuck.",
    categories: ["Recovery"],
    keywords: ["recovery", "tow strap", "shackle", "deflator", "compressor", "jack", "boards"]
  },
  {
    slug: "lighting",
    title: "Lighting Pack",
    description: "Simple lighting upgrades that improve visibility without going overboard.",
    categories: ["Lighting"],
    keywords: ["ditch", "fog", "amber", "light bar", "bed lighting", "switch panel"],
    excludeKeywords: ["auxbeam"]
  },
  {
    slug: "storage",
    title: "Storage Pack",
    description: "Practical storage and utility parts for keeping gear organized on trips.",
    categories: ["Storage", "Overland", "Interior / Electronics"],
    keywords: ["storage", "molle", "tool", "ratchet", "rack", "cargo", "compressor"]
  },
  {
    slug: "appearance",
    title: "Appearance Pack",
    description: "Affordable exterior upgrades that clean up the look of the truck without hurting daily drivability.",
    categories: ["Appearance", "Exterior", "Wheel Hardware"],
    keywords: ["grille", "emblem", "badge", "trim", "cosmetic", "lug", "spline", "valve", "cap"]
  }
];

export function getPartPack(slug: string) {
  return partPacks.find((pack) => pack.slug === slug);
}

export function productMatchesPartPack(product: Pick<ProductSummary, "category" | "name" | "description" | "brand">, pack: PartPack) {
  const productCategory = normalizeProductCategory(product.category);
  const categoryMatch = pack.categories.some((category) => normalizeProductCategory(category) === productCategory);
  const searchableText = [
    product.name,
    product.brand,
    product.description,
    product.category
  ].filter(Boolean).join(" ").toLowerCase();
  const excluded = pack.excludeKeywords?.some((keyword) => searchableText.includes(keyword.toLowerCase())) ?? false;
  if (excluded) return false;

  const keywordMatch = pack.keywords.some((keyword) => searchableText.includes(keyword.toLowerCase()));

  return categoryMatch || keywordMatch;
}
