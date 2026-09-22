import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { isPaidPlanActive, repairBillingLinksForUser } from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAccess";
import { getFitmentEntitlementForUser } from "@/lib/fitmentEntitlements";
import { SignInForm } from "./SignInForm";
import { PortalButton } from "./PortalButton";
import { SignOutButton } from "./SignOutButton";
import { FitmentCreditsCheckoutButton } from "./FitmentCreditsCheckoutButton";

export default async function AccountPage() {
  if (!hasSupabaseServerEnv()) {
    return (
      <section className="band">
        <div className="section grid two">
          <div>
            <p className="eyebrow">Account</p>
            <h1>Account access is temporarily unavailable.</h1>
            <p className="lead">Something went wrong while loading this page. We’re working to fix it. Please refresh or try again shortly.</p>
          </div>
          <div className="card">
            <h2>Please try again shortly.</h2>
            <p className="muted">We couldn’t load this information right now. Please try again shortly.</p>
          </div>
        </div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);

  if (!currentUser) {
    return (
      <section className="band">
        <div className="section grid two">
          <div>
            <p className="eyebrow">Account</p>
            <h1>Sign in to save fitment checks.</h1>
            <p className="lead">Use a secure sign-in link to save fitment checks and buy more when the free ones are used.</p>
          </div>
          <SignInForm />
        </div>
      </section>
    );
  }

  const { user, userId } = currentUser;
  const admin = createSupabaseAdminClient();

  await repairBillingLinksForUser({
    supabase: admin,
    userId,
    email: user.email
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: plan } = await admin.from("user_plans").select("*").eq("user_id", userId).maybeSingle();
  const { data: stripeCustomer } = await admin.from("stripe_customers").select("*").eq("user_id", userId).maybeSingle();
  const { data: subscription } = await admin.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const fitmentEntitlement = await getFitmentEntitlementForUser(userId);
  const hasPaidAccess = isPaidPlanActive(plan?.plan, plan?.status);
  const planName = fitmentEntitlement.canViewPremiumBuilds || hasPaidAccess ? "Premium" : "Free";
  const displayName = profile?.display_name || user.email || "Signed-in user";
  const canAccessAdmin = isAdminEmail(user.email);
  const showDebug = process.env.NODE_ENV === "development";

  console.log("Account page plan lookup result:", {
    userId,
    email: user.email,
    plan,
    stripeCustomer
  });

  return (
    <section className="band">
      <div className="section grid two">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your account</h1>
          <p className="lead">Manage your credits, Priority access, and billing.</p>
        </div>
        <div className="card">
          <div className="spec-row"><span className="muted">Profile</span><strong>{displayName}</strong></div>
          <div className="spec-row"><span className="muted">Role</span><strong>{profile?.role ?? "user"}</strong></div>
          <div className="spec-row"><span className="muted">Email</span><strong>{user.email}</strong></div>
          <div className="spec-row"><span className="muted">Plan</span><strong>{planName}</strong></div>
          <div className="spec-row"><span className="muted">Credits</span><strong>{canAccessAdmin ? "Unlimited" : fitmentEntitlement.spendableCredits}</strong></div>
          <div className="spec-row"><span className="muted">Priority</span><strong>{fitmentEntitlement.priority || hasPaidAccess ? "On" : "Off"}</strong></div>
          <div className="spec-row"><span className="muted">Subscription</span><strong>{hasPaidAccess ? plan?.status : subscription?.status ?? "none"}</strong></div>
          <hr style={{ borderColor: "var(--border-color)", margin: "20px 0" }} />
          <h2>Buy credits</h2>
          <div className="spec-row"><span className="muted">Verified Builds library</span><strong>{fitmentEntitlement.canViewPremiumBuilds ? "Unlocked" : "Locked"}</strong></div>
          <p className="fine" style={{ marginTop: 10 }}>$4.99 adds 50 credits. $14.99 adds 150. $25/month adds 250 credits and Priority.</p>
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <FitmentCreditsCheckoutButton pack="credits_50" label="50 credits — $4.99" />
            <FitmentCreditsCheckoutButton pack="credits_150" label="150 credits — $14.99" />
            <FitmentCreditsCheckoutButton pack="priority" label="Priority — $25/month" />
          </div>
          <hr style={{ borderColor: "var(--border-color)", margin: "20px 0" }} />
          <h2>Billing</h2>
          <div style={{ marginTop: 20 }}><PortalButton /></div>
          <div style={{ marginTop: 12 }}><SignOutButton /></div>
          {canAccessAdmin ? (
            <div style={{ marginTop: 12 }}>
              <a className="button primary full" href="/admin">Open Admin</a>
            </div>
          ) : null}
          {showDebug ? (
            <pre className="muted" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
              {JSON.stringify({
                user: { id: userId, email: user.email },
                user_plans: plan,
                stripe_customers: stripeCustomer
              }, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}
