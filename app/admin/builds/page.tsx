import { AdminPageIntro } from "@/app/admin/_components/AdminShell";
import {
  AdminMessage,
  BuildReviewCard,
  canLoadAdminRouteData,
  loadPendingBuilds
} from "@/app/admin/_components/AdminTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminBuildsPage() {
  if (!(await canLoadAdminRouteData())) return null;

  const { builds, error } = await loadPendingBuilds(createSupabaseAdminClient());

  return (
    <>
      <AdminPageIntro title="Pending Builds" copy="Review and publish submitted builds." />
      {error ? (
        <AdminMessage title="Review queue could not load." copy={error} />
      ) : (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="eyebrow">Pending Builds</p>
              <h2>{builds.length} waiting for review</h2>
            </div>
          </div>
          {builds.length ? (
            <div className="admin-build-list">
              {builds.map((build) => (
                <BuildReviewCard build={build} key={build.id} />
              ))}
            </div>
          ) : (
            <AdminMessage title="No builds waiting for review." copy="New submissions will appear here before they are published." />
          )}
        </section>
      )}
    </>
  );
}
