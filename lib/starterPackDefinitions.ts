import { partPacks } from "@/lib/partPackConfig";

export type StarterPackGroupDefinition = {
  title: string;
  category: string;
  matchCategories: string[];
  items: string[];
  note: string;
};

export type StarterPackDefinition = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  groups: StarterPackGroupDefinition[];
};

const starterItemsBySlug: Record<string, string[]> = {
  recovery: ["Recovery boards", "Tow strap", "Soft shackles with recovery ring", "Hitch recovery point", "Tire deflator", "Portable air compressor"],
  lighting: ["Ditch lights", "Amber fog lights", "Light bar", "Bed lighting", "Switch panel"],
  storage: ["Bed molle panels", "Tool kit", "Ratchet straps", "Bed rack / storage accessories", "Cargo organization"],
  appearance: ["Grille", "Wheel hardware", "Emblems / badges", "Cosmetic lighting", "Exterior trim / accessories"]
};

export const starterPackDefinitions: StarterPackDefinition[] = partPacks.map((pack) => ({
  slug: pack.slug,
  name: pack.title,
  subtitle: pack.description,
  description: "Pick the parts you still need, skip the ones you already own, and check out with only the useful upgrades.",
  groups: [
    {
      title: pack.title,
      category: pack.title.replace(" Pack", ""),
      matchCategories: pack.categories,
      items: starterItemsBySlug[pack.slug] ?? [],
      note: pack.description
    }
  ]
}));
