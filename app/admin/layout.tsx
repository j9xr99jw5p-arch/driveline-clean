import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminAccessGate, loadAdminAccess } from "@/app/admin/_components/AdminTools";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await loadAdminAccess();

  if (!access.error && !access.signedIn) {
    redirect("/account?auth=required");
  }

  if (!access.error && access.signedIn && !access.adminEmailAllowed) {
    redirect("/account?admin=unauthorized");
  }

  return (
    <section className="band admin-band">
      <div className="section admin-shell">
        <aside className="admin-nav-panel">
          <div>
            <p className="eyebrow">Driveline</p>
            <h1>Admin</h1>
          </div>
          <AdminNavigation />
        </aside>
        <main className="admin-main">
          {access.adminUnlocked ? children : <AdminAccessGate access={access} />}
        </main>
      </div>
    </section>
  );
}
