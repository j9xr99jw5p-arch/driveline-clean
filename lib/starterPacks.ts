import "server-only";
import { displayProductCategory, normalizeProductCategory } from "@/lib/products";
import { starterPackDefinitions, type StarterPackDefinition } from "@/lib/starterPackDefinitions";
import type { StarterPack, StarterPackProduct } from "@/lib/starterPackTypes";
import { getStripePriceMap, resolveDisplayPrice } from "@/lib/stripePrices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProductRow = {
  id: string;
  slug?: string | null;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  image_url: string | null;
  price_cents?: number | null;
  stripe_price_id?: string | null;
  active: boolean;
};

type StarterPackRow = {
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  starter_pack_items?: StarterPackItemRow[] | null;
};

type StarterPackItemRow = {
  required: boolean | null;
  default_selected: boolean | null;
  recommended_quantity: number | null;
  budget_tier: string | null;
  note: string | null;
  products: ProductRow | ProductRow[] | null;
};

export async function getStarterPacks() {
  const supabase = createSupabaseAdminClient();
  const { data: packRows, error: packError } = await supabase
    .from("starter_packs")
    .select(`
      slug,
      name,
      subtitle,
      description,
      starter_pack_items (
        required,
        default_selected,
        recommended_quantity,
        budget_tier,
        note,
        sort_order,
        products (
          id,
          slug,
          name,
          brand,
          category,
          description,
          image_url,
          price_cents,
          stripe_price_id,
          active
        )
      )
    `)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("sort_order", { referencedTable: "starter_pack_items", ascending: true });

  if (!packError && packRows?.length) {
    const products = (packRows as StarterPackRow[])
      .flatMap((pack) => pack.starter_pack_items ?? [])
      .map((item) => Array.isArray(item.products) ? item.products[0] : item.products)
      .filter((product): product is ProductRow => Boolean(product));
    const stripePrices = await getStripePriceMap(products.map((product) => product.stripe_price_id));

    return buildPacksFromRows(packRows as StarterPackRow[], stripePrices);
  }

  if (packError && packError.code !== "42P01" && packError.code !== "PGRST200" && packError.code !== "PGRST205") {
    console.error("Starter pack query failed:", packError);
  }

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, slug, name, brand, category, description, image_url, price_cents, stripe_price_id, active")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (productError) {
    console.error("Starter pack fallback product query failed:", productError);
    return buildFallbackPacks([], new Map());
  }

  const productRows = (products ?? []) as ProductRow[];
  const stripePrices = await getStripePriceMap(productRows.map((product) => product.stripe_price_id));

  return buildFallbackPacks(productRows, stripePrices);
}

function buildPacksFromRows(rows: StarterPackRow[], stripePrices: Awaited<ReturnType<typeof getStripePriceMap>>): StarterPack[] {
  return rows.map((row) => {
    const definition = findDefinition(row.slug);
    const products = (row.starter_pack_items ?? [])
      .map((item) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        if (!product?.active) return null;
        return mapProduct(product, stripePrices, {
          note: item.note,
          required: Boolean(item.required),
          defaultSelected: item.default_selected ?? true,
          recommendedQuantity: item.recommended_quantity ?? 1,
          budgetTier: item.budget_tier
        });
      })
      .filter((product): product is StarterPackProduct => Boolean(product));

    return {
      slug: row.slug,
      name: row.name,
      subtitle: row.subtitle ?? definition?.subtitle ?? "",
      description: row.description ?? definition?.description ?? "",
      groups: (definition?.groups ?? [{
        title: "Recommended Parts",
        category: "Parts",
        matchCategories: [],
        items: [],
        note: "Select only the parts you still need."
      }]).map((group) => ({
        title: group.title,
        category: group.category,
        items: group.items,
        note: group.note,
        products: products.filter((product) => group.matchCategories.length === 0
          || group.matchCategories.some((category) => normalizeProductCategory(product.category) === normalizeProductCategory(category)))
      }))
    };
  });
}

function buildFallbackPacks(products: ProductRow[], stripePrices: Awaited<ReturnType<typeof getStripePriceMap>>): StarterPack[] {
  return starterPackDefinitions.map((definition) => ({
    slug: definition.slug,
    name: definition.name,
    subtitle: definition.subtitle,
    description: definition.description,
    groups: definition.groups.map((group) => ({
      title: group.title,
      category: group.category,
      items: group.items,
      note: group.note,
      products: products
        .filter((product) => group.matchCategories.some((category) => normalizeProductCategory(product.category) === normalizeProductCategory(category)))
        .slice(0, 4)
        .map((product) => mapProduct(product, stripePrices, {
          note: group.note,
          required: false,
          defaultSelected: true,
          recommendedQuantity: 1,
          budgetTier: "budget"
        }))
    }))
  }));
}

function mapProduct(product: ProductRow, stripePrices: Awaited<ReturnType<typeof getStripePriceMap>>, options: {
  note: string | null;
  required: boolean;
  defaultSelected: boolean;
  recommendedQuantity: number;
  budgetTier: string | null;
}): StarterPackProduct {
  const price = resolveDisplayPrice({
    stripePriceId: product.stripe_price_id,
    priceCents: product.price_cents
  }, stripePrices);

  return {
    id: product.id,
    slug: product.slug ?? product.id,
    name: product.name,
    brand: product.brand,
    category: displayProductCategory(product.category),
    description: product.description,
    imageUrl: product.image_url,
    priceCents: price.priceCents,
    priceLabel: price.priceLabel,
    priceSource: price.priceSource,
    note: options.note,
    required: options.required,
    defaultSelected: options.required || options.defaultSelected,
    recommendedQuantity: Math.max(1, Math.min(10, options.recommendedQuantity)),
    budgetTier: options.budgetTier
  };
}

function findDefinition(slug: string): StarterPackDefinition | undefined {
  return starterPackDefinitions.find((definition) => definition.slug === slug);
}
