import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="section hero-grid">
          <div>
            <p className="eyebrow">Toyota Tacoma Fitment Verifier</p>
            <h1>Stop guessing. Get fitment advice that won’t let you down.</h1>
            <p className="lead">Enter your Tacoma setup and compare it against a curated verified-build library. Driveline calls out rubbing risk, trimming, body mount chop likelihood, and real-world tradeoffs before you buy parts.</p>
            <div className="actions">
              <Link className="button primary" href="/check">Check My Fitment <ArrowRight size={18} /></Link>
              <Link className="button" href="/builds">Browse Verified Builds</Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="spec-panel" style={{ width: "min(440px, 100%)" }}>
              <p className="eyebrow">Example Report</p>
              <div className="spec-row"><span className="muted">Setup</span><strong>285/70R17, -12 offset</strong></div>
              <div className="spec-row"><span className="muted">Lift</span><strong>2.5 in</strong></div>
              <div className="spec-row"><span className="muted">Rubbing risk</span><strong>Medium</strong></div>
              <div className="spec-row"><span className="muted">Likely work</span><strong>Liner movement, minor trim</strong></div>
            </div>
          </div>
        </div>
      </section>
      <section className="band alt">
        <div className="section grid three">
          <div className="card feature-card"><ShieldCheck size={24} /><h3>Honest assessments</h3><p className="muted">See rubbing, trimming, clearance, and drivability warnings before money leaves your account.</p></div>
          <div className="card feature-card"><CheckCircle2 size={24} /><h3>Verified build data</h3><p className="muted">Browse real Tacoma setups with tire, wheel, lift, rubbing, and owner/source details.</p></div>
          <div className="card feature-card"><ArrowRight size={24} /><h3>No clutter</h3><p className="muted">Focused on fitment checks, verified builds, submissions, pricing, and account essentials.</p></div>
        </div>
      </section>
    </>
  );
}
