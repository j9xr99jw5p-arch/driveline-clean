import Link from "next/link";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export default async function VerifiedBuildsAdminPage() {
  let signedIn = false;

  if (hasSupabaseServerEnv()) {
    const supabase = await createSupabaseServerClient();
    signedIn = Boolean(await getCurrentSupabaseUser(supabase));
  }

  return (
    <section className="band">
      <div className="section">
        <div className="page-head">
          <p className="eyebrow">Admin</p>
          <h1>Verified Builds Admin</h1>
          <p className="lead">Add or review Tacoma build data before it appears on the public verified builds page.</p>
        </div>

        <div className="card admin-warning">
          <h2>Admin protection still needs to be connected before production.</h2>
          <p className="muted">
            {signedIn
              ? "You are signed in, but this route does not yet verify an admin role."
              : "Sign-in or role-based admin protection is not active for this route yet."}
          </p>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h2>Admin workflow placeholder</h2>
          <div className="detail-grid">
            <div className="detail-field"><span>Vehicle Info</span><strong>Year, make, model, trim, cab, and bed</strong></div>
            <div className="detail-field"><span>Wheel / Tire</span><strong>Tire size, wheel size, wheel offset, and lift height</strong></div>
            <div className="detail-field"><span>Fitment Outcome</span><strong>Rubbing, trimming, body mount chop, risk, and notes</strong></div>
            <div className="detail-field"><span>Publishing</span><strong>Keep builds unpublished until reviewed</strong></div>
          </div>
          <div className="actions" style={{ justifyContent: "flex-start", marginTop: 24 }}>
            <Link className="button primary" href="/submit-build">Use Submission Form</Link>
            <Link className="button" href="/builds">View Public Builds</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
