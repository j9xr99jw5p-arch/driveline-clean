import { AdminPageIntro } from "@/app/admin/_components/AdminShell";
import { canLoadAdminRouteData, loadProductStock, loadStoreProductManagementData, ProductStockPanel } from "@/app/admin/_components/AdminTools";
import { AdminStoreProductsManager } from "@/components/admin/AdminStoreProductsManager";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPartsPage() {
  if (!(await canLoadAdminRouteData())) return null;

  const admin = createSupabaseAdminClient();
  const [products, storeProductsData] = await Promise.all([
    loadProductStock(admin),
    loadStoreProductManagementData(admin)
  ]);

  return (
    <>
      <AdminPageIntro title="Parts Inventory" copy="Manage product variant stock and product notes." />
      <AdminStoreProductsManager data={storeProductsData} />
      <ProductStockPanel products={products} />
    </>
  );
}
