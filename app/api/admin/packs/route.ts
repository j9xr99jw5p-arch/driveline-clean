import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasValidAdminSession } from "@/lib/adminAccess";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

const savePackSchema = z.object({
  pack_id: z.string().uuid(),
  assignments: z.array(z.object({
    product_id: z.string().uuid(),
    sort_order: z.number().int().min(0),
    quantity: z.number().int().min(1).max(10),
    selected_by_default: z.boolean()
  })).max(100)
});

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Site connection is not configured." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || !(await hasValidAdminSession(currentUser.user.email))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const parsed = savePackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pack changes are invalid." }, { status: 400 });
  }

  const productIds = parsed.data.assignments.map((assignment) => assignment.product_id);
  if (new Set(productIds).size !== productIds.length) {
    return NextResponse.json({ error: "Each product can only be assigned to this pack once." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: pack, error: packError } = await admin
    .from("packs")
    .select("id, slug, active")
    .eq("id", parsed.data.pack_id)
    .maybeSingle();

  if (packError) {
    console.error("Pack save lookup failed:", packError);
    return NextResponse.json({ error: "Pack changes could not be saved." }, { status: 500 });
  }

  if (!pack) {
    return NextResponse.json({ error: "Pack was not found." }, { status: 404 });
  }

  if (productIds.length) {
    const { data: activeProducts, error: productsError } = await admin
      .from("products")
      .select("id")
      .eq("active", true)
      .in("id", productIds);

    if (productsError) {
      console.error("Pack save product validation failed:", productsError);
      return NextResponse.json({ error: "Pack products could not be validated." }, { status: 500 });
    }

    if ((activeProducts ?? []).length !== productIds.length) {
      return NextResponse.json({ error: "Only active products can be assigned to packs." }, { status: 400 });
    }
  }

  const rows = parsed.data.assignments.map((assignment, index) => ({
    pack_id: parsed.data.pack_id,
    product_id: assignment.product_id,
    sort_order: index,
    quantity: assignment.quantity,
    selected_by_default: assignment.selected_by_default
  }));

  if (rows.length) {
    const { error: upsertError } = await admin
      .from("pack_products")
      .upsert(rows, { onConflict: "pack_id,product_id" });

    if (upsertError) {
      console.error("Pack products upsert failed:", upsertError);
      return NextResponse.json({ error: "Pack changes could not be saved." }, { status: 500 });
    }
  }

  const deleteQuery = admin
    .from("pack_products")
    .delete()
    .eq("pack_id", parsed.data.pack_id);

  const deleteResult = productIds.length
    ? await deleteQuery.not("product_id", "in", `(${productIds.join(",")})`)
    : await deleteQuery;

  if (deleteResult.error) {
    console.error("Pack products delete stale rows failed:", deleteResult.error);
    return NextResponse.json({ error: "Pack changes were saved, but stale assignments could not be removed." }, { status: 500 });
  }

  revalidatePath("/admin/verified-builds");
  revalidatePath("/parts");
  revalidatePath("/parts/starter-packs");
  revalidatePath(`/parts/packs/${pack.slug}`);

  return NextResponse.json({ message: "Pack saved." });
}
