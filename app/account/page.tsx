import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { SignInForm } from "./SignInForm";
import { PortalButton } from "./PortalButton";

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
            <p className="lead">Use a secure sign-in link to save fitment checks and manage your subscription.</p>
          </div>
          <SignInForm />
        </div>
      </section>
    );
  }

  const { user, userId } = currentUser;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: plan } = await supabase.from("user_plans").select("*").eq("user_id", userId).single();
  const { data: subscription } = await supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const planName = plan?.plan === "builder" || plan?.plan === "pro_garage" ? "Builder Plus" : "Free";
  const checkLimit = (plan?.fitment_check_limit ?? 3) >= 999999 ? "Unlimited" : String(plan?.fitment_check_limit ?? 3);
  const displayName = profile?.display_name || user.email || "Signed-in user";

  return (
    <section className="band">
      <div className="section grid two">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Subscription</h1>
          <p className="lead">Manage your Driveline plan, fitment-check usage, and billing access.</p>
        </div>
        <div className="card">
          <div className="spec-row"><span className="muted">Profile</span><strong>{displayName}</strong></div>
          <div className="spec-row"><span className="muted">Role</span><strong>{profile?.role ?? "user"}</strong></div>
          <div className="spec-row"><span className="muted">Email</span><strong>{user.email}</strong></div>
          <div className="spec-row"><span className="muted">Plan</span><strong>{planName}</strong></div>
          <div className="spec-row"><span className="muted">Checks used</span><strong>{plan?.fitment_checks_used ?? 0} / {checkLimit}</strong></div>
          <div className="spec-row"><span className="muted">Subscription</span><strong>{subscription?.status ?? "none"}</strong></div>
          <div style={{ marginTop: 20 }}><PortalButton /></div>
        </div>
      </div>
    </section>
  );
}
