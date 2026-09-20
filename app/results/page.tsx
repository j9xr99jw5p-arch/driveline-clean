"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizeAiExplanation } from "@/lib/fitmentAi";
import {
  firstSentence,
  formatFitmentLabel,
  loadFitmentResult,
  toShortParagraphs
} from "@/lib/reportRenderer";
import type { MatchedVerifiedBuild, StoredFitmentResult } from "@/lib/types";

function AdviceBox({
  title,
  text,
  limit = 2
}: {
  title: string;
  text: string;
  limit?: number;
}) {
  return (
    <article className="card fitment-box">
      <h2>{title}</h2>
      {toShortParagraphs(text, limit).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </article>
  );
}

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
          <div className="card fitment-box" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
            <p className="eyebrow">Fitment Results</p>
            <h1>No fitment result yet.</h1>
            <p>Start a check to see a short, readable report.</p>
            <Link className="button primary" href="/check">Start Fitment Check</Link>
          </div>
        </div>
      </section>
    );
  }

  const { input, report } = result;
  const advice = normalizeAiExplanation(report.aiExplanation, report);
  const insights = report.premiumInsights;
  const matchedBuilds = report.matchedBuilds ?? [];
  const displayedWarnings = (report.premiumWarnings?.length ? report.premiumWarnings : report.warnings)
    .filter((warning) => warning !== insights?.trimDetail)
    .slice(0, 3);
  const vehicleLine = [input.year, input.make, input.model, input.trim].filter(Boolean).join(" ");
  const cabBed = [input.cab, input.bed].filter((value) => value && value !== "Not specified").join(" / ");
  const setupFacts = [
    { label: "Vehicle", value: vehicleLine },
    cabBed ? { label: "Cab / Bed", value: cabBed } : null,
    { label: "Tire", value: input.tireSize },
    input.currentTireSize ? { label: "Current tire", value: input.currentTireSize } : null,
    { label: "Wheel", value: `${input.wheelDiameter}x${input.wheelWidth}, ${input.wheelOffset}mm` },
    { label: "Lift", value: `${input.liftHeight} in` },
    { label: "Use", value: formatFitmentLabel(input.useCase) },
    { label: "Rear weight", value: formatFitmentLabel(input.rearLoad) }
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const submitBuildHref = `/submit-build?year=${encodeURIComponent(String(input.year))}&make=${encodeURIComponent(input.make ?? "")}&model=${encodeURIComponent(input.model ?? "")}`;

  return (
    <section className="band">
      <div className="section fitment-report">
        {result.generatedImageUrl ? (
          <figure className="fitment-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.generatedImageUrl} alt={`Estimated look for ${vehicleLine}`} />
            <figcaption>Estimated look — not a guarantee</figcaption>
          </figure>
        ) : null}

        {result.alreadyModified ? (
          <article className="card fitment-box fitment-verify-card">
            <p className="eyebrow">Already built?</p>
            <h2>This truck already looks built. Want it verified?</h2>
            <p>If this is your current setup, submit it so other owners can learn from a real build.</p>
            <Link className="button primary" href={submitBuildHref}>Get Verified</Link>
          </article>
        ) : null}

        <header className="fitment-report-hero">
          <p className="eyebrow">Fitment Results</p>
          <span className={`pill ${report.rubbingRisk}`}>{report.rubbingRisk} risk</span>
          <h1>{report.verdict}</h1>
          <p className="fitment-report-lead">{firstSentence(report.explanation)}</p>
          {notice ? <p className="muted">{notice}</p> : null}
        </header>

        <div className="fitment-report-grid">
          <article className="card fitment-box">
            <h2>Your setup</h2>
            {setupFacts.map((fact) => (
              <div className="spec-row" key={fact.label}>
                <span className="muted">{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
            {input.buildGoals ? (
              <p className="fine" style={{ marginTop: 12 }}>{firstSentence(input.buildGoals)}</p>
            ) : null}
          </article>

          <article className="card fitment-box">
            <h2>The bottom line</h2>
            {toShortParagraphs(advice.overviewAdvice, 2).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="fitment-signals">
              <div className="spec-row">
                <span className="muted">Trimming</span>
                <strong>{report.trimmingLikely ? "Likely" : "Not likely"}</strong>
              </div>
              <div className="spec-row">
                <span className="muted">Body mount chop</span>
                <strong>{report.bodyMountChopLikely ? "Check it" : "Not likely"}</strong>
              </div>
              <div className="spec-row">
                <span className="muted">Daily driving</span>
                <strong>{formatFitmentLabel(report.dailyDrivability)}</strong>
              </div>
              <div className="spec-row">
                <span className="muted">Off-road</span>
                <strong>{formatFitmentLabel(report.offRoadPracticality)}</strong>
              </div>
            </div>
          </article>
        </div>

        <div className="fitment-report-grid">
          <AdviceBox title="Daily driving" text={advice.dailyDrivingAdvice} />
          <AdviceBox title="Off-road" text={advice.offRoadAdvice} />
        </div>

        <AdviceBox title="Before you buy" text={advice.beforeYouCommit} />

        {displayedWarnings.length ? (
          <article className="card fitment-box">
            <h2>Watchouts</h2>
            <ul className="fitment-watchouts">
              {displayedWarnings.map((warning) => (
                <li key={warning}>{firstSentence(warning)}</li>
              ))}
            </ul>
          </article>
        ) : null}

        {insights ? (
          <div className="fitment-report-grid">
            <article className="card fitment-box">
              <h2>A cleaner option</h2>
              {insights.alternativeSetup ? (
                <>
                  <p>{firstSentence(insights.alternativeSetup.summary)}</p>
                  <div className="spec-row">
                    <span className="muted">Suggested wheel</span>
                    <strong>{insights.alternativeSetup.wheelWidth} in, {insights.alternativeSetup.wheelOffset}mm</strong>
                  </div>
                </>
              ) : (
                <p>No nearby offset or width change lowered the risk in this check.</p>
              )}
            </article>

            <article className="card fitment-box">
              <h2>Where it can rub</h2>
              {insights.scenarioBreakdown.map((scenario) => (
                <div className="spec-row" key={scenario.scenario}>
                  <span className="muted">{scenario.scenario}</span>
                  <strong className={`pill ${scenario.risk}`}>{scenario.risk}</strong>
                </div>
              ))}
              {insights.trimDetail ? (
                <p className="fine" style={{ marginTop: 12 }}>{firstSentence(insights.trimDetail)}</p>
              ) : null}
            </article>
          </div>
        ) : null}

        <article className="card fitment-box">
          <h2>Verified builds like yours</h2>
          <p>{insights?.verifiedBuildMatchStatus ?? "Verified-build matches are included with every check."}</p>
          {matchedBuilds.length ? (
            <div className="fitment-match-list">
              {matchedBuilds.map((build) => (
                <MatchedBuildCard key={build.id} build={build} />
              ))}
            </div>
          ) : null}
        </article>

        <footer className="fitment-report-foot">
          <p className="fine">{advice.disclaimer}</p>
          <Link className="button" href="/check">Run another check</Link>
        </footer>
      </div>
    </section>
  );
}

function MatchedBuildCard({ build }: { build: MatchedVerifiedBuild }) {
  return (
    <article className="fitment-match">
      {build.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={build.photoUrl} alt={build.photoAlt ?? build.title} />
      ) : (
        <div className="fitment-match-empty">No photo</div>
      )}
      <div>
        <div className="fitment-match-head">
          <strong>{build.title}</strong>
          {build.risk ? <span className={`pill ${build.risk}`}>{build.risk} risk</span> : null}
        </div>
        <p>{build.wheel}</p>
        <p>{build.lift}</p>
        <div className="spec-row">
          <span className="muted">Rubbing</span>
          <strong>{build.rubbing}</strong>
        </div>
        <div className="spec-row">
          <span className="muted">Trimming</span>
          <strong>{build.trimming}</strong>
        </div>
        {build.notes ? <p className="fine">{build.notes}</p> : null}
      </div>
    </article>
  );
}
