import Link from "next/link";
import { SubmitBuildForm } from "./SubmitBuildForm";

export default function SubmitBuildPage() {
  return (
    <>
      <section className="hero">
        <div className="section page-head center">
          <p className="eyebrow">Driveline Builds</p>
          <h1>Submit Your Tacoma Build</h1>
          <p className="lead">
            Send us your wheel, tire, suspension, and clearance details. If your build is a good fit, we’ll turn it into a clean Driveline build card and add it to the verified builds page.
          </p>
          <div className="actions">
            <a className="button primary" href="#build-submission-form">Start Submission</a>
            <Link className="button" href="/builds">View Verified Builds</Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="section submit-build-layout">
          <div className="submit-build-copy">
            <p className="eyebrow">Build Details</p>
            <h2>Share as much detail as you have.</h2>
            <p className="lead">
              You can fill out the fields manually, paste a complete parts list, attach a file, or do all three. Clear tire, wheel, lift, and rubbing notes help us create a more useful build card.
            </p>
            <div className="card">
              <h3>What helps most</h3>
              <ul className="stack-list">
                <li>Wheel and tire specs, including offset if you know it.</li>
                <li>Lift height and suspension details.</li>
                <li>Honest notes about rubbing, trimming, and body mount clearance.</li>
                <li>A photo, screenshot, or spec sheet if that is easier than typing everything out.</li>
              </ul>
            </div>
          </div>

          <div id="build-submission-form">
            <SubmitBuildForm />
          </div>
        </div>
      </section>
    </>
  );
}
