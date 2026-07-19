import Link from "next/link";
import { AdminPageIntro } from "@/app/admin/_components/AdminShell";
import { AdminMessage, canLoadAdminRouteData, loadDashboardMetrics } from "@/app/admin/_components/AdminTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const quickLinks = [
  { label: "Visitor Tracking", href: "/admin/visitors", copy: "Recent traffic, top pages, and visit details." },
  { label: "Parts Inventory", href: "/admin/parts", copy: "Product stock, variant status, and product notes." },
  { label: "Manage Packs", href: "/admin/packs", copy: "Assign products to packs without changing categories." },
  { label: "Pending Builds", href: "/admin/builds", copy: "Review, summarize, and publish submitted builds." }
];

export default async function AdminDashboardPage() {
  if (!(await canLoadAdminRouteData())) return null;

  const metrics = await loadDashboardMetrics(createSupabaseAdminClient());

  return (
    <>
      <AdminPageIntro title="Admin" copy="Welcome back. Here's what's happening across Driveline." />
      <section className="admin-overview-grid" aria-label="Admin overview">
        {metrics.map((metric) => (
          <article className={`admin-overview-card ${metric.error ? "error" : ""}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.supportingText}</p>
            {metric.href ? <Link href={metric.href}>Open</Link> : null}
          </article>
        ))}
      </section>

      <section className="admin-action-grid" aria-label="Admin sections">
        {quickLinks.map((link) => (
          <Link className="admin-action-card" href={link.href} key={link.href}>
            <strong>{link.label}</strong>
            <span>{link.copy}</span>
          </Link>
        ))}
      </section>

      <AdminMessage
        title="Sales data note"
        copy="Total Sales is not shown because Supabase orders do not currently store a live/test-mode marker. Add a livemode field from Stripe webhook events before using orders for production sales totals."
      />
    </>
  );
}
