import { FitmentForm } from "./FitmentForm";

export default function CheckPage() {
  return (
    <section className="band">
      <div className="section grid two">
        <div>
          <p className="eyebrow">Fitment Questionnaire</p>
          <h1>Check your Tacoma setup before you buy parts.</h1>
          <p className="lead">Enter the tire, wheel, lift, and use-case details that matter. Driveline returns a conservative, plain-English report focused on rubbing, trimming, body mount clearance, and daily drivability.</p>
          <div className="card" style={{ marginTop: "1.5rem" }}>
            <h3>What Driveline checks</h3>
            <div className="detail-grid">
              <div className="detail-field"><span>Clearance</span><strong>Tire size, offset, lift, and rubbing risk</strong></div>
              <div className="detail-field"><span>Street use</span><strong>Daily drivability and suspension stress</strong></div>
              <div className="detail-field"><span>Trail use</span><strong>Off-road practicality and likely compromises</strong></div>
            </div>
          </div>
          <div className="card" style={{ marginTop: "1rem" }}>
            <h3>Good inputs make better answers</h3>
            <p className="muted">Use the exact tire format when you can, like 285/70R17 or 35x12.50R17. Wheel offset accepts stock, positive, zero, and negative offsets.</p>
          </div>
        </div>
        <FitmentForm />
      </div>
    </section>
  );
}
