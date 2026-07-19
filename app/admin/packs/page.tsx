import { AdminPackManager } from "@/components/AdminPackManager";
import { AdminPageIntro } from "@/app/admin/_components/AdminShell";
import { AdminMessage, canLoadAdminRouteData, loadPackManagementData } from "@/app/admin/_components/AdminTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPacksPage() {
  if (!(await canLoadAdminRouteData())) return null;

  const packManagementData = await loadPackManagementData(createSupabaseAdminClient());

  return (
    <>
      <AdminPageIntro title="Manage Packs" copy="Assign products to packs without changing product categories." />
      {packManagementData ? (
        <AdminPackManager data={packManagementData} />
      ) : (
        <AdminMessage title="Pack manager unavailable." copy="Run the pack-management migration to enable pack editing." />
      )}
    </>
  );
}
