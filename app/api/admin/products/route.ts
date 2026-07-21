import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { formatCents } from "@/lib/products";
import { hasValidAdminSession } from "@/lib/adminAccess";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

const updateProductSchema = z.object({
  product_id: z.string().uuid(),
  active: z.boolean().optional(),
  packSlugs: z.array(z.string().trim().min(1).max(100)).optional()
}).refine((payload) => payload.active !== undefined || payload.packSlugs !== undefined, {
  message: "No product changes were provided."
});

type ProductResponseRow = {
  id: string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  active: boolean | null;
  inventory_status: string | null;
  price_cents: number | null;
  updated_at: string | null;
  image_url: string | null;
  product_images?: Array<{ url: string | null; sort_order: number | null }> | null;
  product_variants?: Array<{ active: boolean | null; inventory_status: string | null; price_cents: number | null }> | null;
  pack_products?: Array<{ packs: { slug: string } | Array<{ slug: string }> | null }> | null;
};

export async function PATCH(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Site connection is not configured." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || !(await hasValidAdminSession(currentUser.user.email))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const parsed = updateProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Product changes are invalid." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, slug")
    .eq("id", parsed.data.product_id)
    .maybeSingle();

  if (productError) {
    console.error("Admin product lookup failed:", productError);
    return NextResponse.json({ error: "Product could not be loaded." }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ error: "Product was not found." }, { status: 404 });
  }

  if (parsed.data.active !== undefined) {
    const { error } = await admin
      .from("products")
      .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.product_id);

    if (error) {
      console.error("Admin product active update failed:", error);
      return NextResponse.json({ error: "Store visibility could not be updated." }, { status: 500 });
    }
  }

  if (parsed.data.packSlugs !== undefined) {
    const uniquePackSlugs = Array.from(new Set(parsed.data.packSlugs));
    const { data: packs, error: packError } = uniquePackSlugs.length
      ? await admin
          .from("packs")
          .select("id, slug")
          .eq("active", true)
          .in("slug", uniquePackSlugs)
      : { data: [], error: null };

    if (packError) {
      console.error("Admin product pack lookup failed:", packError);
      return NextResponse.json({ error: "Pack assignments could not be loaded." }, { status: 500 });
    }

    if ((packs ?? []).length !== uniquePackSlugs.length) {
      return NextResponse.json({ error: "One or more packs are invalid." }, { status: 400 });
    }

    const desiredPacks = (packs ?? []) as Array<{ id: string; slug: string }>;
    const desiredPackIds = desiredPacks.map((pack) => pack.id);

    const { data: existingAssignments, error: existingAssignmentsError } = await admin
      .from("pack_products")
      .select("pack_id")
      .eq("product_id", parsed.data.product_id);

    if (existingAssignmentsError) {
      console.error("Admin product existing pack lookup failed:", existingAssignmentsError);
      return NextResponse.json({ error: "Pack assignments could not be loaded." }, { status: 500 });
    }

    const existingPackIds = new Set(((existingAssignments ?? []) as Array<{ pack_id: string }>).map((assignment) => assignment.pack_id));
    const packIdsToInsert = desiredPackIds.filter((packId) => !existingPackIds.has(packId));

    if (packIdsToInsert.length) {
      const rows = await Promise.all(packIdsToInsert.map(async (packId) => ({
        pack_id: packId,
        product_id: parsed.data.product_id,
        sort_order: await getNextPackSortOrder(admin, packId),
        quantity: 1,
        selected_by_default: true
      })));

      const { error: insertError } = await admin
        .from("pack_products")
        .insert(rows);

      if (insertError) {
        console.error("Admin product pack insert failed:", insertError);
        return NextResponse.json({ error: "Pack assignments could not be saved." }, { status: 500 });
      }
    }

    const deleteQuery = admin
      .from("pack_products")
      .delete()
      .eq("product_id", parsed.data.product_id);

    const deleteResult = desiredPackIds.length
      ? await deleteQuery.not("pack_id", "in", `(${desiredPackIds.join(",")})`)
      : await deleteQuery;

    if (deleteResult.error) {
      console.error("Admin product stale pack delete failed:", deleteResult.error);
      return NextResponse.json({ error: "Pack assignments were partially saved." }, { status: 500 });
    }
  }

  const { data: updatedProduct, error: updatedProductError } = await admin
    .from("products")
    .select(`
      id,
      slug,
      name,
      brand,
      category,
      active,
      inventory_status,
      price_cents,
      updated_at,
      image_url,
      product_images(url, sort_order),
      product_variants(id, active, inventory_status, price_cents),
      pack_products(packs(slug))
    `)
    .eq("id", parsed.data.product_id)
    .maybeSingle();

  if (updatedProductError || !updatedProduct) {
    console.error("Admin product reload failed:", updatedProductError);
    return NextResponse.json({ error: "Product was updated, but the refreshed row could not be loaded." }, { status: 500 });
  }

  revalidateProductPaths(product.slug ?? null);

  return NextResponse.json({
    message: "Product updated.",
    product: mapProductResponse(updatedProduct as ProductResponseRow)
  });
}

function mapProductResponse(product: ProductResponseRow) {
  const activeVariants = (product.product_variants ?? []).filter((variant) => variant.active && variant.inventory_status !== "inactive");
  const variantPrices = activeVariants
    .map((variant) => variant.price_cents)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  const lowestPrice = product.price_cents ?? (variantPrices.length ? Math.min(...variantPrices) : null);
  const packSlugs = Array.from(new Set((product.pack_products ?? [])
    .map((assignment) => Array.isArray(assignment.packs) ? assignment.packs[0] : assignment.packs)
    .map((pack) => pack?.slug)
    .filter((slug): slug is string => Boolean(slug))));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category?.trim() || "Uncategorized",
    active: Boolean(product.active),
    inventoryStatus: product.inventory_status ?? null,
    priceLabel: formatCents(lowestPrice) ?? "Unavailable",
    activeVariantCount: activeVariants.length,
    imageUrl: getProductImageUrl(product),
    updatedAt: product.updated_at ?? null,
    packSlugs
  };
}

function getProductImageUrl(product: ProductResponseRow) {
  const firstProductImage = (product.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((image) => image.url?.trim())
    .find(Boolean);

  return firstProductImage ?? product.image_url?.trim() ?? null;
}

async function getNextPackSortOrder(admin: ReturnType<typeof createSupabaseAdminClient>, packId: string) {
  const { data, error } = await admin
    .from("pack_products")
    .select("sort_order")
    .eq("pack_id", packId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Admin next pack sort order lookup failed:", error);
    return 0;
  }

  const lastSortOrder = ((data ?? []) as Array<{ sort_order: number | null }>)[0]?.sort_order ?? -10;
  return lastSortOrder + 10;
}

function revalidateProductPaths(productSlug: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/parts");
  revalidatePath("/admin/packs");
  revalidatePath("/parts");
  revalidatePath("/parts/starter-packs");
  revalidatePath("/builds");
  ["appearance", "lighting", "recovery", "storage"].forEach((slug) => {
    revalidatePath(`/parts/packs/${slug}`);
  });
  if (productSlug) revalidatePath(`/parts/${productSlug}`);
}
