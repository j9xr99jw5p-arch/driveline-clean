export type StarterPackProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  priceLabel: string | null;
  priceSource?: "stripe" | "database" | "unavailable";
  note: string | null;
  required: boolean;
  defaultSelected: boolean;
  recommendedQuantity: number;
  budgetTier: string | null;
};

export type StarterPackGroup = {
  title: string;
  category: string;
  items: string[];
  note: string;
  products: StarterPackProduct[];
};

export type StarterPack = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  groups: StarterPackGroup[];
};
