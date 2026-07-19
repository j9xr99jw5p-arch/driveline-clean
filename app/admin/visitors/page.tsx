import { AdminPageIntro } from "@/app/admin/_components/AdminShell";
import { canLoadAdminRouteData, loadVisitAnalytics, VisitAnalyticsPanel } from "@/app/admin/_components/AdminTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminVisitorsPage() {
  if (!(await canLoadAdminRouteData())) return null;

  const analytics = await loadVisitAnalytics(createSupabaseAdminClient());

  return (
    <>
      <AdminPageIntro title="Visitor Tracking" copy="Traffic snapshots and recent visits." />
      <VisitAnalyticsPanel analytics={analytics} />
    </>
  );
}
