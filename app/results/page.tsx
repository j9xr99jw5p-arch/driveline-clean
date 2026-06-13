"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizeAiExplanation } from "@/lib/fitmentAi";
import { getFitmentSummaryRows, loadFitmentResult } from "@/lib/reportRenderer";
import type { StoredFitmentResult } from "@/lib/types";

export default function ResultsPage() {
  const [result, setResult] = useState<StoredFitmentResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setResult(loadFitmentResult());
    const savedNotice = sessionStorage.getItem("drivelineReportNotice");
    if (savedNotice) {
      setNotice(savedNotice);
      sessionStorage.removeItem("drivelineReportNotice");
    }
  }, []);

  if (!result) {
    return (
      <section className="band">
        <div className="section">
          <div className="card" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <p className="eyebrow">Fitment Results</p>
            <h1>No fitment result yet.</h1>
            <p className="lead">Start a check.</p>
            <Link className="button primary" href="/check">Start Fitment Check</Link>
          </div>
        </div>
      </section>
    );
  }

  const { input, report } = result;
  const advice = normalizeAiExplanation(report.aiExplanation, report);
  const riskLabel = `${report.rubbingRisk.charAt(0).toUpperCase()}${report.rubbingRisk.slice(1)} rubbing risk`;

  return (
    <section className="band">
      <div className="section">
        <div className="page-head center">
          <p className="eyebrow">Fitment Results</p>
          <h1>Your Fitment Report</h1>
          <h2 style={{ marginTop: 12 }}>{report.verdict}</h2>
          <p className="lead">{report.explanation}</p>
          {notice ? <p className="muted">{notice}</p> : null}
          <div className="actions" style={{ justifyContent: "center" }}>
            <Link className="button primary" href="/check">Run another fitment check</Link>
          </div>
        </div>

        <div className="grid two">
          <div className="card">
            <span className={`pill ${report.rubbingRisk}`}>{report.rubbingRisk} risk</span>
            <h2 style={{ marginTop: 16 }}>Assessment Summary</h2>
            {getFitmentSummaryRows(report).map((row) => (
              <div className="spec-row" key={row.label}>
                <span className="muted">{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Submitted Setup</h2>
            <div className="detail-grid">
              <div className="detail-field"><span>Vehicle</span><strong>{input.year} Tacoma {input.trim}</strong></div>
              <div className="detail-field"><span>Cab / Bed</span><strong>{input.cab} / {input.bed}</strong></div>
              <div className="detail-field"><span>Tire</span><strong>{input.tireSize}</strong></div>
              {input.currentTireSize ? <div className="detail-field"><span>Current Tire</span><strong>{input.currentTireSize}</strong></div> : null}
              <div className="detail-field"><span>Wheel</span><strong>{input.wheelDiameter}x{input.wheelWidth}, {input.wheelOffset}mm</strong></div>
              <div className="detail-field"><span>Lift</span><strong>{input.liftHeight} in</strong></div>
              <div className="detail-field"><span>Use Case</span><strong>{input.useCase}</strong></div>
              <div className="detail-field"><span>Rear Weight</span><strong>{input.rearLoad}</strong></div>
            </div>
          </div>
        </div>

        <div className="card fitment-advice-card" style={{ marginTop: 32 }}>
          <div className="fitment-advice-head">
            <div>
              <p className="eyebrow">Fitment Advice</p>
              <h2>What This Setup Means</h2>
            </div>
            <div className="fitment-badges" aria-label="Fitment risk signals">
              <span className={`pill ${report.rubbingRisk}`}>{report.verdict}</span>
              <span className={`pill ${report.rubbingRisk}`}>{riskLabel}</span>
              <span className="pill">Trimming {report.trimmingLikely ? "likely" : "not likely"}</span>
              <span className="pill">Body mount chop {report.bodyMountChopLikely ? "possible" : "not likely"}</span>
            </div>
          </div>

          <div className="fitment-advice-copy">
            <p className="fitment-headline">{advice.headline}</p>
            <p>{advice.overviewAdvice}</p>

            <section>
              <h3>Daily Driving Notes</h3>
              <p>{advice.dailyDrivingAdvice}</p>
            </section>

            <section>
              <h3>Off-Road Notes</h3>
              <p>{advice.offRoadAdvice}</p>
            </section>

            <section>
              <h3>Before You Commit</h3>
              <p>{advice.beforeYouCommit}</p>
            </section>
          </div>

          <p className="fine fitment-disclaimer">{advice.disclaimer}</p>
        </div>

        <div className="grid three" style={{ marginTop: 32 }}>
          <div className="card">
            <h2>Warnings</h2>
            <ul className="stack-list">
              {(report.warnings.length ? report.warnings : ["No major warnings were found for this setup."]).map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
          <div className="card">
            <h2>Recommendations</h2>
            <ul className="stack-list">
              {report.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
            </ul>
          </div>
          <div className="card">
            <h2>Fitment Notes</h2>
            <p className="muted">{input.buildGoals || "No build goals were entered. Re-run the check with goals like daily comfort, less trimming, 33s, or trail use for better context."}</p>
            <p className="fine" style={{ marginTop: 16 }}>Created {new Date(result.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
