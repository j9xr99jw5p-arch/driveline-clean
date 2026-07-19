import { AdminPageIntro } from "@/app/admin/_components/AdminShell";
import { canLoadAdminRouteData, loadProductStock, ProductStockPanel } from "@/app/admin/_components/AdminTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPartsPage() {
  if (!(await canLoadAdminRouteData())) return null;

  const products = await loadProductStock(createSupabaseAdminClient());

  return (
    <>
      <AdminPageIntro title="Parts Inventory" copy="Manage product variant stock and product notes." />
      <ProductStockPanel products={products} />
    </>
  );
}
