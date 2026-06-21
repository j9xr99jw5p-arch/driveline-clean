import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export default async function VerifiedBuildsAdminPage() {
  let signedIn = false;
  let adminEmailAllowed = false;
  let adminUnlocked = false;
  let builds: VerifiedBuild[] = [];
  let analytics: VisitAnalytics | null = null;
  let loadError: string | null = null;
  let currentEmail: string | null = null;

  if (hasSupabaseServerEnv()) {
    const supabase = await createSupabaseServerClient();
    const currentUser = await getCurrentSupabaseUser(supabase);
    signedIn = Boolean(currentUser);
    currentEmail = currentUser?.user.email ?? null;
    adminEmailAllowed = isAdminEmail(currentEmail);
    adminUnlocked = await hasValidAdminSession(currentEmail);

    if (adminUnlocked) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("verified_builds")
        .select("*, verified_build_photos(*)")
        .eq("published", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load unpublished verified builds:", error);
        loadError = error.message;
      } else {
        builds = (data ?? []) as VerifiedBuild[];
      }

      analytics = await loadVisitAnalytics(admin);
    }
  }

  return (
    <section className="band">
      <div className="section">
        <div className="page-head">
          <p className="eyebrow">Admin</p>
          <h1>Verified Builds Admin</h1>
          <p className="lead">Review submitted Tacoma build data and approve it for the public verified builds page.</p>
        </div>

        <div className="card admin-warning admin-compact-card">
          <h2>Admin access is restricted.</h2>
          <p className="muted">
            {adminUnlocked
              ? `Admin session active for ${currentEmail}.`
              : "Sign in with an approved admin email, then enter the admin password to review and approve builds."}
          </p>
        </div>

        <div className="actions admin-actions">
          <Link className="button primary" href="/submit-build">Use Submission Form</Link>
          <Link className="button" href="/builds">View Public Builds</Link>
        </div>

        {!hasSupabaseServerEnv() ? (
          <AdminMessage title="Supabase is not configured." copy="The admin review queue cannot load without Supabase environment variables." />
        ) : !signedIn ? (
          <AdminMessage title="Sign in required." copy="Use your site sign-in flow, then return here to review unpublished submissions." />
        ) : !adminEmailAllowed ? (
          <AdminMessage title="Admin email required." copy="This account is signed in, but its email is not on the admin allowlist." />
        ) : !hasAdminPasswordConfigured() ? (
          <AdminMessage title="Admin password is not configured." copy="Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Netlify before using the admin approval queue." />
        ) : !adminUnlocked ? (
          <AdminPasswordForm email={currentEmail ?? ""} />
        ) : loadError ? (
          <AdminMessage title="Review queue could not load." copy={loadError} />
        ) : (
          <div className="admin-dashboard">
            <VisitAnalyticsPanel analytics={analytics} />
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
                    <BuildReviewCard key={build.id} build={build} />
                  ))}
                </div>
              ) : (
                <AdminMessage title="No builds waiting for review." copy="New submissions will appear here before they are published." />
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

async function loadVisitAnalytics(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<VisitAnalytics | null> {
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

function VisitAnalyticsPanel({ analytics }: { analytics: VisitAnalytics | null }) {
  if (!analytics) {
    return (
      <section className="card admin-analytics admin-compact-card">
        <p className="eyebrow">Visitor Tracking</p>
        <h2>Analytics unavailable</h2>
        <p className="muted">Run the `013_site_visits.sql` migration to enable compact visit analytics.</p>
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

function AdminPasswordForm({ email }: { email: string }) {
  return (
    <form className="card form admin-compact-card" action={unlockAdmin} style={{ marginTop: 28 }}>
      <div>
        <h2>Unlock admin tools</h2>
        <p className="muted">Enter the admin password for {email}.</p>
      </div>
      <label className="field">
        <span>Admin password</span>
        <input name="adminPassword" type="password" required autoComplete="current-password" />
      </label>
      <button className="button primary full" type="submit">Unlock Admin</button>
    </form>
  );
}

function BuildReviewCard({ build }: { build: VerifiedBuild }) {
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

function AdminMessage({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="card" style={{ marginTop: 28 }}>
      <h2>{title}</h2>
      <p className="muted">{copy}</p>
    </div>
  );
}

async function approveBuild(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Supabase is not configured.");
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
        revalidatePath("/admin/verified-builds");
        revalidatePath("/builds");
        revalidatePath(`/builds/${buildId}`);
        return;
      }
    }

    console.error("Failed to approve verified build:", error);
    throw new Error("Build approval failed.");
  }

  revalidatePath("/admin/verified-builds");
  revalidatePath("/builds");
  revalidatePath(`/builds/${buildId}`);
}

async function generateAiSummary(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Supabase is not configured.");
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

  revalidatePath("/admin/verified-builds");
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
            content: "You write concise Toyota Tacoma fitment build explanations for admin review. Do not invent details. Return only the paragraph text."
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

async function unlockAdmin(formData: FormData) {
  "use server";

  if (!hasSupabaseServerEnv()) {
    throw new Error("Supabase is not configured.");
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
  revalidatePath("/admin/verified-builds");
  redirect("/admin/verified-builds");
}
