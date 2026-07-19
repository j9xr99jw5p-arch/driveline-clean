import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import type { PackManagementData } from "@/components/AdminPackManager";
import {
  hasAdminPasswordConfigured,
  hasValidAdminSession,
  isAdminEmail,
  setAdminSession,
  verifyAdminPassword
} from "@/lib/adminAccess";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import {
  formatBuildTitle,
  formatPrimaryFitmentDetails,
  formatSecondaryFitmentDetails,
  formatSuspension,
  formatWheelTireCombo
} from "@/lib/buildDisplay";
import { buildSummaryPrompt, createLocalBuildSummary } from "@/lib/buildSummary";
import {
  getReviewSentimentLabel,
  normalizeReviewRatingBreakdown,
  normalizeReviewStringList,
  reviewSentimentLabels,
  type ReviewSentiment
} from "@/lib/products";
import type { VerifiedBuild } from "@/lib/types";

type SiteVisit = {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  user_id: string | null;
  created_at: string;
};

type VisitAnalytics = {
  total: number;
  today: number;
  week: number;
  topPages: Array<{ path: string; count: number }>;
  recent: SiteVisit[];
};

export type AdminDashboardMetric = {
  label: string;
  value: string;
  supportingText: string;
  href?: string;
  error?: boolean;
};

type ProductStockRow = {
  id: string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string;
  active: boolean;
  review_sentiment: string | null;
  review_summary: string | null;
  review_praise: unknown;
  review_complaints: unknown;
  review_takeaway: string | null;
  review_count_analyzed: number | null;
  review_rating_average: number | null;
  review_rating_breakdown: unknown;
  review_source_name: string | null;
  review_source_url: string | null;
  product_variants: Array<{
    id: string;
    variant_name: string;
    inventory_status: string | null;
    price_cents: number | null;
    active: boolean;
  }> | null;
};

export type AdminAccessState = {
  signedIn: boolean;
  adminEmailAllowed: boolean;
  adminUnlocked: boolean;
  currentEmail: string | null;
  error: string | null;
};

export const loadAdminAccess = cache(async function loadAdminAccess(): Promise<AdminAccessState> {
  if (!hasSupabaseServerEnv()) {
    return {
      signedIn: false,
      adminEmailAllowed: false,
      adminUnlocked: false,
      currentEmail: null,
      error: "Site connection is not configured."
    };
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  const currentEmail = currentUser?.user.email ?? null;

  return {
    signedIn: Boolean(currentUser),
    adminEmailAllowed: isAdminEmail(currentEmail),
    adminUnlocked: await hasValidAdminSession(currentEmail),
    currentEmail,
    error: null
  };
});

export async function canLoadAdminRouteData() {
  const access = await loadAdminAccess();
  return access.adminUnlocked;
}

export function AdminAccessGate({ access, redirectTo = "/admin" }: { access: AdminAccessState; redirectTo?: string }) {
  if (access.error) {
    return <AdminMessage title="Site connection is not configured." copy="The admin dashboard cannot load until the production settings are connected." />;
  }

  if (!access.signedIn) {
    return <AdminMessage title="Sign in required." copy="Use your site sign-in flow, then return here to manage Driveline." />;
  }

  if (!access.adminEmailAllowed) {
    return <AdminMessage title="Admin email required." copy="This account is signed in, but its email is not on the admin allowlist." />;
  }

  if (!hasAdminPasswordConfigured()) {
    return <AdminMessage title="Admin password is not configured." copy="Add the admin password and session secret in your hosting settings before using admin tools." />;
  }

  if (!access.adminUnlocked) {
    return <AdminPasswordForm email={access.currentEmail ?? ""} redirectTo={redirectTo} />;
  }

  return null;
}

export async function loadPackManagementData(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<PackManagementData | null> {
  const [packsResult, productsResult] = await Promise.all([
    admin
      .from("packs")
      .select("id, name, slug, active, sort_order, pack_products(product_id, sort_order, quantity, selected_by_default)")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("products")
      .select("id, name, brand, category")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true })
  ]);

  if (packsResult.error) {
    if (packsResult.error.code !== "42P01" && packsResult.error.code !== "42703" && packsResult.error.code !== "PGRST204") {
      console.error("Failed to load pack management packs:", packsResult.error);
    }
    return null;
  }

  if (productsResult.error) {
    console.error("Failed to load pack management products:", productsResult.error);
    return null;
  }

  type PackRow = {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    sort_order: number | null;
    pack_products?: Array<{
      product_id: string;
      sort_order: number | null;
      quantity: number | null;
      selected_by_default: boolean | null;
    }> | null;
  };
  type ProductRow = {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
  };

  const products = ((productsResult.data ?? []) as ProductRow[]).map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category?.trim() || null
  }));
  const categories = Array.from(new Set(products.map((product) => product.category ?? "Uncategorized"))).sort((a, b) => a.localeCompare(b));

  return {
    packs: ((packsResult.data ?? []) as PackRow[])
      .filter((pack) => pack.active)
      .map((pack) => ({
        id: pack.id,
        name: pack.name,
        slug: pack.slug,
        assignments: Array.from(new Map((pack.pack_products ?? []).map((assignment) => [assignment.product_id, {
          productId: assignment.product_id,
          sortOrder: assignment.sort_order ?? 0,
          quantity: Math.max(1, Math.min(10, assignment.quantity ?? 1)),
          selectedByDefault: assignment.selected_by_default ?? true
        }])).values())
          .sort((left, right) => left.sortOrder - right.sortOrder)
      })),
    products,
    categories
  };
}

export async function loadPendingBuilds(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<{ builds: VerifiedBuild[]; error: string | null }> {
  const { data, error } = await admin
    .from("verified_builds")
    .select("*, verified_build_photos(*)")
    .eq("published", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load unpublished verified builds:", error);
    return { builds: [], error: error.message };
  }

  return { builds: (data ?? []) as VerifiedBuild[], error: null };
}

export async function loadDashboardMetrics(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<AdminDashboardMetric[]> {
  const [traffic, sales, pendingBuilds] = await Promise.all([
    loadTrafficMetric(admin),
    loadSalesMetric(admin),
    loadPendingBuildCountMetric(admin)
  ]);

  return [traffic, sales, pendingBuilds];
}

async function loadTrafficMetric(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<AdminDashboardMetric> {
  const { data, error, count } = await admin
    .from("site_visits")
    .select("user_id", { count: "exact" })
    .limit(10000);

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") {
      console.error("Failed to load traffic overview:", error);
    }
    return {
      label: "Total Traffic",
      value: "Unavailable",
      supportingText: "Site visit totals could not be loaded.",
      href: "/admin/visitors",
      error: true
    };
  }

  const uniqueSignedInVisitors = new Set((data ?? [])
    .map((visit: { user_id: string | null }) => visit.user_id)
    .filter(Boolean)).size;

  return {
    label: "Total Traffic",
    value: String(count ?? (data ?? []).length),
    supportingText: uniqueSignedInVisitors
      ? `${uniqueSignedInVisitors} signed-in unique visitors tracked by user_id`
      : "Total recorded site visits",
    href: "/admin/visitors"
  };
}

async function loadSalesMetric(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<AdminDashboardMetric> {
  const { error } = await admin
    .from("orders")
    .select("id, amount_total, status", { count: "exact" })
    .eq("status", "paid")
    .limit(1);

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") {
      console.error("Failed to load sales overview:", error);
    }
    return {
      label: "Total Sales",
      value: "Unavailable",
      supportingText: "Completed order storage is not available.",
      href: "/admin/parts",
      error: true
    };
  }

  return {
    label: "Total Sales",
    value: "Unavailable",
    supportingText: "Supabase orders stores status and amount_total, but no live/test-mode marker; safe production sales totals need a livemode field.",
    href: "/admin/parts"
  };
}

async function loadPendingBuildCountMetric(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<AdminDashboardMetric> {
  const { error, count } = await admin
    .from("verified_builds")
    .select("id", { count: "exact", head: true })
    .eq("published", false);

  if (error) {
    console.error("Failed to load pending build count:", error);
    return {
      label: "Builds Waiting for Review",
      value: "Unavailable",
      supportingText: "Pending build count could not be loaded.",
      href: "/admin/builds",
      error: true
    };
  }

  return {
    label: "Builds Waiting for Review",
    value: String(count ?? 0),
    supportingText: "Uses verified_builds.published = false; no separate review status field exists.",
    href: "/admin/builds"
  };
}

export async function loadVisitAnalytics(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<VisitAnalytics | null> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error, count } = await admin
    .from("site_visits")
    .select("id, path, referrer, user_agent, user_id, created_at", { count: "exact" })
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") {
      console.error("Failed to load site visit analytics:", error);
    }
    return null;
  }

  const visits = (data ?? []) as SiteVisit[];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);
  const topPages = Array.from(visits.reduce((map, visit) => {
    map.set(visit.path, (map.get(visit.path) ?? 0) + 1);
    return map;
  }, new Map<string, number>()))
    .map(([path, pageCount]) => ({ path, count: pageCount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    total: count ?? visits.length,
    today: visits.filter((visit) => new Date(visit.created_at) >= startOfToday).length,
    week: visits.filter((visit) => new Date(visit.created_at) >= startOfWeek).length,
    topPages,
    recent: visits.slice(0, 8)
  };
}

export async function loadProductStock(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<ProductStockRow[]> {
  const { data, error } = await admin
    .from("products")
    .select("id, slug, name, brand, category, active, review_sentiment, review_summary, review_praise, review_complaints, review_takeaway, review_count_analyzed, review_rating_average, review_rating_breakdown, review_source_name, review_source_url, product_variants(id, variant_name, inventory_status, price_cents, active)")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      const fallback = await admin
        .from("products")
        .select("id, slug, name, brand, category, active, product_variants(id, variant_name, inventory_status, price_cents, active)")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (!fallback.error) {
        return ((fallback.data ?? []) as ProductStockRow[]).map((product) => ({
          ...product,
          review_sentiment: null,
          review_summary: null,
          review_praise: null,
          review_complaints: null,
          review_takeaway: null,
          review_count_analyzed: null,
          review_rating_average: null,
          review_rating_breakdown: null,
          review_source_name: null,
          review_source_url: null
        }));
      }
    }

    if (error.code !== "42P01" && error.code !== "42703" && error.code !== "PGRST204") {
      console.error("Failed to load product stock:", error);
    }
    return [];
  }

  return (data ?? []) as ProductStockRow[];
}

export function ProductStockPanel({ products }: { products: ProductStockRow[] }) {
  return (
    <section className="card admin-product-stock admin-compact-card">
      <div className="admin-panel-head">
        <div>
          <p className="eyebrow">Parts Inventory</p>
          <h2>Product stock</h2>
        </div>
        <Link className="button" href="/parts">View parts</Link>
      </div>
      {products.length ? (
        <div className="admin-stock-list">
          {products.map((product) => {
            const variants = product.product_variants?.length ? product.product_variants : [];

            return (
              <div className="admin-product-editor" key={product.id}>
                <div className="admin-product-editor-head">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{[product.brand, product.category, product.active ? "Active" : "Inactive"].filter(Boolean).join(" / ")}</span>
                  </div>
                  {getReviewSentimentLabel(product.review_sentiment) ? <span>{getReviewSentimentLabel(product.review_sentiment)}</span> : null}
                </div>
                {variants.length ? variants.map((variant) => (
                  <form action={updateProductStock} className="admin-stock-row" key={variant.id}>
                    <input type="hidden" name="variantId" value={variant.id} />
                    <div>
                      <strong>{variant.variant_name}</strong>
                      <span>{variant.active ? "Visible variant" : "Hidden variant"}</span>
                    </div>
                    <select name="inventoryStatus" defaultValue={variant.inventory_status || "in_stock"} aria-label={`Stock status for ${product.name}`}>
                      <option value="in_stock">In stock</option>
                      <option value="out_of_stock">Out of stock</option>
                      <option value="unknown">Unknown</option>
                      <option value="inactive">Hidden</option>
                    </select>
                    <button className="button" type="submit">Update</button>
                  </form>
                )) : <p className="muted">No variants are configured for stock management.</p>}
                <OwnerReviewAdminForm product={product} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">Finish the product catalog setup to manage part stock here.</p>
      )}
    </section>
  );
}

function OwnerReviewAdminForm({ product }: { product: ProductStockRow }) {
  const praise = normalizeReviewStringList(product.review_praise);
  const complaints = normalizeReviewStringList(product.review_complaints);
  const breakdown = normalizeReviewRatingBreakdown(product.review_rating_breakdown);

  return (
    <details className="admin-collapsible admin-review-editor">
      <summary>Owner Review Summary</summary>
      <form action={updateProductReviewSummary} className="admin-review-form">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="productSlug" value={product.slug ?? ""} />

        <div className="admin-review-grid">
          <label className="field">
            <span>Sentiment</span>
            <select name="reviewSentiment" defaultValue={product.review_sentiment ?? ""}>
              <option value="">No sentiment</option>
              {(Object.keys(reviewSentimentLabels) as ReviewSentiment[]).map((sentiment) => (
                <option value={sentiment} key={sentiment}>{reviewSentimentLabels[sentiment]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reviews analyzed</span>
            <input name="reviewCountAnalyzed" type="number" min="0" step="1" defaultValue={product.review_count_analyzed ?? ""} />
          </label>
          <label className="field">
            <span>Average rating</span>
            <input name="reviewRatingAverage" type="number" min="0" max="5" step="0.01" defaultValue={product.review_rating_average ?? ""} />
          </label>
        </div>

        <label className="field">
          <span>Summary</span>
          <textarea name="reviewSummary" rows={4} defaultValue={product.review_summary ?? ""} />
        </label>

        <div className="admin-review-grid two">
          <ReviewListInputs label="Common praise" name="reviewPraise" values={praise} />
          <ReviewListInputs label="Common complaints" name="reviewComplaints" values={complaints} />
        </div>

        <label className="field">
          <span>Driveline takeaway</span>
          <textarea name="reviewTakeaway" rows={3} defaultValue={product.review_takeaway ?? ""} />
        </label>

        <div className="admin-review-rating-grid" aria-label="Rating breakdown">
          {(["5", "4", "3", "2", "1"] as const).map((rating) => (
            <label className="field" key={rating}>
              <span>{rating} star</span>
              <input name={`rating${rating}`} type="number" min="0" step="1" defaultValue={breakdown[rating] ?? ""} />
            </label>
          ))}
        </div>

        <div className="admin-review-grid two">
          <label className="field">
            <span>Source name</span>
            <input name="reviewSourceName" defaultValue={product.review_source_name ?? ""} />
          </label>
          <label className="field">
            <span>Source URL</span>
            <input name="reviewSourceUrl" type="url" defaultValue={product.review_source_url ?? ""} />
          </label>
        </div>

        <button className="button primary" type="submit">Save owner summary</button>
      </form>
    </details>
  );
}

function ReviewListInputs({ label, name, values }: { label: string; name: string; values: string[] }) {
  const rows = Array.from({ length: Math.max(4, values.length + 1) }, (_, index) => values[index] ?? "");

  return (
    <fieldset className="admin-review-list-field">
      <legend>{label}</legend>
      {rows.map((value, index) => (
        <input name={name} defaultValue={value} placeholder={`${label} ${index + 1}`} key={`${name}-${index}`} />
      ))}
    </fieldset>
  );
}

export function VisitAnalyticsPanel({ analytics }: { analytics: VisitAnalytics | null }) {
  if (!analytics) {
    return (
      <section className="card admin-analytics admin-compact-card">
        <p className="eyebrow">Visitor Tracking</p>
        <h2>Analytics unavailable</h2>
        <p className="muted">Finish the visitor tracking setup to enable compact visit analytics.</p>
      </section>
    );
  }

  return (
    <section className="card admin-analytics">
      <div className="admin-panel-head">
        <div>
          <p className="eyebrow">Visitor Tracking</p>
          <h2>Site activity</h2>
        </div>
      </div>
      <div className="admin-metric-grid">
        <Metric label="Today" value={analytics.today} />
        <Metric label="This week" value={analytics.week} />
        <Metric label="30-day total" value={analytics.total} />
      </div>
      <div className="admin-analytics-grid">
        <div>
          <h3>Top pages</h3>
          <div className="admin-mini-list">
            {analytics.topPages.length ? analytics.topPages.map((page) => (
              <div key={page.path}><span>{page.path}</span><strong>{page.count}</strong></div>
            )) : <p className="muted">No page visits yet.</p>}
          </div>
        </div>
        <div>
          <h3>Recent visits</h3>
          <div className="admin-mini-list">
            {analytics.recent.length ? analytics.recent.map((visit) => (
              <div key={visit.id}>
                <span>
                  {visit.path}
                  <small>{[visit.referrer ? `from ${visit.referrer}` : null, visit.user_id ? "logged in" : "anonymous", shortUserAgent(visit.user_agent)].filter(Boolean).join(" · ")}</small>
                </span>
                <strong>{new Date(visit.created_at).toLocaleString()}</strong>
              </div>
            )) : <p className="muted">No recent visits yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function shortUserAgent(userAgent: string | null) {
  if (!userAgent) return null;
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

export function AdminPasswordForm({ email, redirectTo }: { email: string; redirectTo: string }) {
  return (
    <form className="card form admin-compact-card admin-message-card" action={unlockAdmin}>
      <div>
        <h2>Unlock admin tools</h2>
        <p className="muted">Enter the admin password for {email}.</p>
      </div>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <label className="field">
        <span>Admin password</span>
        <input name="adminPassword" type="password" required autoComplete="current-password" />
      </label>
      <button className="button primary full" type="submit">Unlock Admin</button>
    </form>
  );
}

export function BuildReviewCard({ build }: { build: VerifiedBuild }) {
  const photos = [...(build.verified_build_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const draftSummary = build.build_summary?.trim() || createLocalBuildSummary(build);

  return (
    <article className="card admin-build-card">
      <div className="admin-build-head">
        <div>
          <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
          <h2 style={{ marginTop: 10 }}>{formatBuildTitle(build)}</h2>
          <p className="muted" style={{ marginTop: 6 }}>{build.owner_name ?? "Owner not provided"}</p>
        </div>
      </div>

      {photos.length ? (
        <div className="admin-photo-grid">
          {photos.map((photo) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="build-media" style={{ minHeight: 150 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt_text ?? "new submission build photo"} />
            </a>
          ))}
        </div>
      ) : (
        <p className="muted">No submitted photos attached.</p>
      )}

      <details className="admin-collapsible" open>
        <summary>Raw build data</summary>
        <div className="detail-grid admin-detail-grid">
          <div className="detail-field"><span>Wheel / Tire</span><strong>{formatWheelTireCombo(build)}</strong></div>
          <div className="detail-field"><span>Suspension</span><strong>{formatSuspension(build)}</strong></div>
          <div className="detail-field"><span>Fitment</span><strong>{formatPrimaryFitmentDetails(build)}</strong></div>
          <div className="detail-field"><span>Clearance</span><strong>{formatSecondaryFitmentDetails(build)}</strong></div>
          <div className="detail-field"><span>Lighting</span><strong>{build.lighting_upgrades || "Not provided"}</strong></div>
          <div className="detail-field"><span>Favorite mods</span><strong>{build.favorite_modifications || "Not provided"}</strong></div>
        </div>
      </details>

      {build.notes ? (
        <details className="admin-collapsible">
          <summary>Submission notes</summary>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{build.notes}</p>
        </details>
      ) : null}

      {build.source_url ? (
        <p className="muted">
          Source: <a href={build.source_url} target="_blank" rel="noreferrer">{build.source_url}</a>
        </p>
      ) : null}

      <div className="admin-summary-panel">
        <div>
          <p className="eyebrow">Review Summary</p>
          <h3>Approved build explanation</h3>
          <p className="muted">Generate a draft with AI, edit it here, then approve. Public build pages use this reviewed text.</p>
        </div>
        <form action={generateAiSummary}>
          <input type="hidden" name="buildId" value={build.id} />
          <button className="button" type="submit">Generate AI Summary</button>
        </form>
        <form action={approveBuild} className="summary-approval-form">
          <input type="hidden" name="buildId" value={build.id} />
          <label className="field">
            <span>Build summary</span>
            <textarea name="buildSummary" defaultValue={draftSummary} rows={7} />
          </label>
          <button className="button primary full" type="submit">Approve and Publish</button>
        </form>
      </div>
    </article>
  );
}

export function AdminMessage({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="card admin-message-card">
      <h2>{title}</h2>
      <p className="muted">{copy}</p>
    </div>
  );
}

async function approveBuild(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Site connection is not configured.");
  }

  const buildId = formData.get("buildId");
  const buildSummary = formData.get("buildSummary");
  if (typeof buildId !== "string" || !buildId) {
    throw new Error("Missing build ID.");
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || !(await hasValidAdminSession(currentUser.user.email))) {
    throw new Error("You must unlock admin access before approving builds.");
  }

  const admin = createSupabaseAdminClient();
  const updatePayload = {
    published: true,
    ...(typeof buildSummary === "string" && buildSummary.trim() ? { build_summary: buildSummary.trim() } : {})
  };
  const { error } = await admin
    .from("verified_builds")
    .update(updatePayload)
    .eq("id", buildId);

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      const fallback = await admin
        .from("verified_builds")
        .update({ published: true })
        .eq("id", buildId);

      if (!fallback.error) {
        revalidatePath("/admin/builds");
        revalidatePath("/builds");
        revalidatePath(`/builds/${buildId}`);
        return;
      }
    }

    console.error("Failed to approve verified build:", error);
    throw new Error("Build approval failed.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/builds");
  revalidatePath("/builds");
  revalidatePath(`/builds/${buildId}`);
}

async function generateAiSummary(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Site connection is not configured.");
  }

  const buildId = formData.get("buildId");
  if (typeof buildId !== "string" || !buildId) {
    throw new Error("Missing build ID.");
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || !(await hasValidAdminSession(currentUser.user.email))) {
    throw new Error("You must unlock admin access before generating summaries.");
  }

  const admin = createSupabaseAdminClient();
  const { data: build, error } = await admin
    .from("verified_builds")
    .select("*")
    .eq("id", buildId)
    .maybeSingle();

  if (error || !build) {
    console.error("Failed to load build for AI summary:", error);
    throw new Error("Could not load build for summary generation.");
  }

  const summary = await generateOpenAiBuildSummary(build as VerifiedBuild);
  const { error: updateError } = await admin
    .from("verified_builds")
    .update({ build_summary: summary })
    .eq("id", buildId);

  if (updateError) {
    console.error("Failed to save AI build summary:", updateError);
    throw new Error("Could not save AI summary.");
  }

  revalidatePath("/admin/builds");
}

async function generateOpenAiBuildSummary(build: VerifiedBuild) {
  if (!process.env.OPENAI_API_KEY) return createLocalBuildSummary(build);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_BUILD_SUMMARY_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "You write concise Toyota Tacoma fitment advice for real owners. Sound natural and practical, not like database output. Do not invent details. Return only the paragraph text."
          },
          {
            role: "user",
            content: buildSummaryPrompt(build)
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("OpenAI build summary request failed:", await response.text());
      return createLocalBuildSummary(build);
    }

    const data = await response.json();
    const text = data.output_text || data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? []).map((item: { text?: string }) => item.text).filter(Boolean).join("\n");
    return typeof text === "string" && text.trim() ? text.trim() : createLocalBuildSummary(build);
  } catch (error) {
    console.error("OpenAI build summary generation crashed:", error);
    return createLocalBuildSummary(build);
  }
}

async function updateProductStock(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Site connection is not configured.");
  }

  const variantId = formData.get("variantId");
  const inventoryStatus = formData.get("inventoryStatus");
  const allowedStatuses = new Set(["in_stock", "out_of_stock", "unknown", "inactive"]);
  if (typeof variantId !== "string" || !variantId) {
    throw new Error("Missing product variant.");
  }
  if (typeof inventoryStatus !== "string" || !allowedStatuses.has(inventoryStatus)) {
    throw new Error("Invalid inventory status.");
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || !(await hasValidAdminSession(currentUser.user.email))) {
    throw new Error("You must unlock admin access before updating product stock.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("product_variants")
    .update({ inventory_status: inventoryStatus })
    .eq("id", variantId);

  if (error) {
    console.error("Failed to update product stock:", error);
    throw new Error("Product stock update failed.");
  }

  revalidatePath("/admin/parts");
  revalidatePath("/parts");
  revalidatePath("/builds");
}

async function updateProductReviewSummary(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Site connection is not configured.");
  }

  const productId = getFormString(formData, "productId");
  const productSlug = getFormString(formData, "productSlug");
  if (!productId) {
    throw new Error("Missing product.");
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || !(await hasValidAdminSession(currentUser.user.email))) {
    throw new Error("You must unlock admin access before updating product review summaries.");
  }

  const reviewSentiment = getFormString(formData, "reviewSentiment");
  const allowedSentiments = new Set(Object.keys(reviewSentimentLabels));
  const reviewPraise = getFormStringList(formData, "reviewPraise");
  const reviewComplaints = getFormStringList(formData, "reviewComplaints");
  const ratingBreakdown = buildRatingBreakdown(formData);
  const updatePayload = {
    review_sentiment: reviewSentiment && allowedSentiments.has(reviewSentiment) ? reviewSentiment : null,
    review_summary: getFormString(formData, "reviewSummary"),
    review_praise: reviewPraise.length ? reviewPraise : null,
    review_complaints: reviewComplaints.length ? reviewComplaints : null,
    review_takeaway: getFormString(formData, "reviewTakeaway"),
    review_count_analyzed: getFormInteger(formData, "reviewCountAnalyzed"),
    review_rating_average: getFormNumber(formData, "reviewRatingAverage"),
    review_rating_breakdown: Object.keys(ratingBreakdown).length ? ratingBreakdown : null,
    review_source_name: getFormString(formData, "reviewSourceName"),
    review_source_url: getFormString(formData, "reviewSourceUrl")
  };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (error) {
    console.error("Failed to update product review summary:", error);
    throw new Error("Product review summary update failed.");
  }

  revalidatePath("/admin/parts");
  revalidatePath("/parts");
  if (productSlug) revalidatePath(`/parts/${productSlug}`);
}

async function unlockAdmin(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Site connection is not configured.");
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);

  if (!currentUser || !isAdminEmail(currentUser.user.email)) {
    throw new Error("This account is not allowed to access admin tools.");
  }

  const password = formData.get("adminPassword");
  if (typeof password !== "string" || !verifyAdminPassword(password)) {
    throw new Error("Invalid admin password.");
  }

  await setAdminSession(currentUser.user.email ?? "");
  const redirectTo = formData.get("redirectTo");
  const safeRedirect = typeof redirectTo === "string" && redirectTo.startsWith("/admin") ? redirectTo : "/admin";
  revalidatePath(safeRedirect);
  redirect(safeRedirect);
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed || null;
}

function getFormStringList(formData: FormData, name: string) {
  return formData.getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getFormInteger(formData: FormData, name: string) {
  const value = getFormString(formData, name);
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function getFormNumber(formData: FormData, name: string) {
  const value = getFormString(formData, name);
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function buildRatingBreakdown(formData: FormData) {
  return (["5", "4", "3", "2", "1"] as const).reduce<Record<string, number>>((breakdown, rating) => {
    const value = getFormInteger(formData, `rating${rating}`);
    if (value !== null) breakdown[rating] = value;
    return breakdown;
  }, {});
}
