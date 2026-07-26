import type { FitmentInput, FitmentReport, FitmentRisk, PremiumFitmentInsights } from "./types";

export function normalizeFitmentInput(values: Record<string, FormDataEntryValue | string | number | undefined>): FitmentInput {
  return {
    year: Number(values.year),
    trim: String(values.trim ?? ""),
    cab: String(values.cab ?? ""),
    bed: String(values.bed ?? ""),
    currentTireSize: optionalString(values.currentTireSize),
    tireSize: String(values.tireSize ?? ""),
    wheelDiameter: Number(values.wheelDiameter),
    wheelWidth: Number(values.wheelWidth),
    wheelOffset: Number(values.wheelOffset),
    liftHeight: Number(values.liftHeight),
    useCase: String(values.useCase ?? ""),
    rearLoad: String(values.rearLoad ?? ""),
    buildGoals: optionalString(values.buildGoals)
  };
}

function optionalString(value: FormDataEntryValue | string | number | undefined) {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
}

function parseTireWidth(tireSize: string) {
  const clean = tireSize.trim();

  const metric = clean.match(/^(\d{3})\//i);
  if (metric) return Number(metric[1]);

  const flotation = clean.match(/^\d{2}(?:\.\d+)?x(\d{1,2}(?:\.\d+)?)/i);
  if (flotation) return Math.round(Number(flotation[1]) * 25.4);

  return 0;
}

function parseTireDiameter(tireSize: string) {
  const flotation = tireSize.match(/^(\d{2}(?:\.\d)?)[xX]/);
  if (flotation) return Number(flotation[1]);
  const metric = tireSize.match(/^(\d{3})\/(\d{2})R(\d{2})$/i);
  if (!metric) return 0;
  const width = Number(metric[1]);
  const aspect = Number(metric[2]) / 100;
  const wheel = Number(metric[3]);
  return Math.round(((width * aspect * 2) / 25.4 + wheel) * 10) / 10;
}

const riskRank: Record<FitmentRisk, number> = { low: 1, medium: 2, high: 3 };

function maxRisk(...risks: FitmentRisk[]): FitmentRisk {
  return risks.reduce((best, risk) => (riskRank[risk] > riskRank[best] ? risk : best), "low");
}

function lowerRisk(a: FitmentRisk, b: FitmentRisk) {
  return riskRank[a] < riskRank[b];
}

function riskLabel(risk: FitmentRisk) {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function buildCoreFitmentReport(input: FitmentInput): FitmentReport {
  const width = parseTireWidth(input.tireSize);
  const diameter = parseTireDiameter(input.tireSize);
  const wide = width >= 285 || diameter >= 33;
  const large = width >= 315 || diameter >= 34.5;
  const aggressiveOffset = input.wheelOffset <= -12;
  const veryAggressiveOffset = input.wheelOffset <= -25;
  const lowLift = input.liftHeight < 2;

  const rubbingRisk = maxRisk(
    large ? "high" : wide ? "medium" : "low",
    wide && aggressiveOffset ? "medium" : "low",
    wide && veryAggressiveOffset ? "high" : "low",
    wide && lowLift ? "high" : "low"
  );

  const trimmingLikely = rubbingRisk !== "low" || (wide && input.liftHeight < 2.5);
  const bodyMountChopLikely = large || (wide && veryAggressiveOffset);
  const suspensionStress = large || input.rearLoad === "constant-heavy" ? "high" : wide ? "moderate" : "low";
  const dailyDrivability = rubbingRisk === "high" ? "compromised" : rubbingRisk === "medium" ? "acceptable" : "easy";
  const offRoadPracticality = input.useCase === "off-road" && rubbingRisk !== "high" ? "strong" : rubbingRisk === "high" ? "limited" : "balanced";
  const verdict = rubbingRisk === "low" ? "Likely clean fitment" : rubbingRisk === "medium" ? "Workable with minor setup attention" : "High-risk fitment";
  const warnings = [
    !diameter || !width ? "Tire size could not be fully parsed, so the report is conservative and should be physically verified." : null,
    rubbingRisk === "high" ? "Expect contact at full lock, compression, or both unless the setup is carefully trimmed and aligned." : null,
    bodyMountChopLikely ? "Body mount clearance is a likely constraint with this tire and offset combination." : null,
    input.liftHeight === 0 && wide ? "Stock-height clearance is limited for this tire size." : null,
    input.rearLoad === "constant-heavy" ? "Constant rear weight can reduce usable travel and increase suspension stress." : null
  ].filter((warning): warning is string => Boolean(warning));
  const recommendations = [
    trimmingLikely ? "Plan for liner movement, mud flap removal, and careful trimming before assuming this is bolt-on." : "Still check clearance at full lock and under compression before buying.",
    bodyMountChopLikely ? "Verify the body mount/cab mount area before committing to the tire size." : "Body mount work is not expected from the entered setup, but real trucks vary.",
    veryAggressiveOffset ? "Consider a less negative offset if daily drivability and reduced rubbing matter more than stance." : "Keep alignment and caster in mind; small alignment changes can affect tire clearance.",
    input.useCase === "off-road" ? "Cycle the suspension with the tires mounted before trail use." : "For daily use, prioritize predictable clearance over maximum tire size."
  ];

  return {
    verdict,
    rubbingRisk,
    trimmingLikely,
    bodyMountChopLikely,
    suspensionStress,
    dailyDrivability,
    offRoadPracticality,
    explanation: `${input.tireSize} on a ${input.wheelDiameter}x${input.wheelWidth} wheel with ${input.wheelOffset}mm offset is a ${rubbingRisk}-risk Tacoma setup. ${trimmingLikely ? "Expect liner movement or trimming." : "Trimming is unlikely for normal street driving."} ${bodyMountChopLikely ? "A body mount chop may be needed at full lock or off-road." : "A body mount chop is not likely."}`,
    warnings,
    recommendations
  };
}

export function assessFitment(input: FitmentInput): FitmentReport {
  return buildCoreFitmentReport(input);
}

export function buildPremiumFitmentInsights(input: FitmentInput, report = buildCoreFitmentReport(input)): PremiumFitmentInsights {
  return {
    alternativeSetup: findLowerRiskAlternative(input, report),
    scenarioBreakdown: buildScenarioBreakdown(input, report),
    trimDetail: describeTrimNeeds(input, report),
    verifiedBuildMatchStatus: "Verified-build match status is checked after the report is submitted.",
    notesReasoning: describeNotesInfluence(input, report)
  };
}

export function buildPremiumWarnings(input: FitmentInput, report: FitmentReport): string[] {
  return [
    report.trimmingLikely ? describeTrimNeeds(input, report) : null,
    report.rubbingRisk === "high" ? "Prioritize the suggested lower-risk setup before buying wheels or tires; this entered setup leaves little margin for real-truck variance." : null,
    input.useCase === "off-road" || /overland|trail|camp|off[- ]?road/i.test(input.buildGoals ?? "")
      ? "Because trail or overland use was selected, compression and articulation clearance matter more than parking-lot clearance."
      : null,
    report.bodyMountChopLikely ? "Check cab-mount clearance with the exact tire mounted before assuming alignment alone will solve contact." : null
  ].filter((warning): warning is string => Boolean(warning));
}

function findLowerRiskAlternative(input: FitmentInput, report: FitmentReport): PremiumFitmentInsights["alternativeSetup"] {
  const offsetCandidates = Array.from(new Set([
    input.wheelOffset + 6,
    input.wheelOffset + 12,
    input.wheelOffset < 0 ? 0 : input.wheelOffset - 6
  ])).filter((offset) => offset >= -80 && offset <= 80);
  const widthCandidates = Array.from(new Set([
    input.wheelWidth,
    input.wheelWidth > 7 ? input.wheelWidth - 0.5 : input.wheelWidth,
    input.wheelWidth > 7.5 ? input.wheelWidth - 1 : input.wheelWidth
  ])).filter((width) => width >= 6 && width <= 14);

  const candidates = offsetCandidates.flatMap((wheelOffset) => widthCandidates.map((wheelWidth) => ({
    wheelOffset,
    wheelWidth,
    report: buildCoreFitmentReport({ ...input, wheelOffset, wheelWidth })
  })));
  const improvingCandidates = candidates
    .filter((candidate) => lowerRisk(candidate.report.rubbingRisk, report.rubbingRisk))
    .sort((a, b) => riskRank[a.report.rubbingRisk] - riskRank[b.report.rubbingRisk]);
  const best = improvingCandidates[0];
  if (!best) return null;

  const widthPhrase = best.wheelWidth === input.wheelWidth ? "same wheel width" : `${best.wheelWidth} in wheel width`;
  return {
    summary: `At ${best.wheelOffset}mm offset with ${widthPhrase}, rubbing risk drops from ${riskLabel(report.rubbingRisk)} to ${riskLabel(best.report.rubbingRisk)}.`,
    currentRisk: report.rubbingRisk,
    suggestedRisk: best.report.rubbingRisk,
    wheelOffset: best.wheelOffset,
    wheelWidth: best.wheelWidth
  };
}

function buildScenarioBreakdown(input: FitmentInput, report: FitmentReport): PremiumFitmentInsights["scenarioBreakdown"] {
  const trailWeighted = input.useCase === "off-road" || /overland|trail|rock|camp/i.test(input.buildGoals ?? "");
  const onRoadRisk: FitmentRisk = report.rubbingRisk === "high" && input.liftHeight >= 2.5 ? "medium" : report.rubbingRisk;
  const fullLockRisk = report.rubbingRisk;
  const articulationRisk = maxRisk(report.rubbingRisk, trailWeighted || input.rearLoad !== "normal" ? "medium" : "low");

  return [
    { scenario: "On-road driving", risk: onRoadRisk, detail: `Derived from the aggregate rules engine. Expect ${onRoadRisk} risk in normal street driving when alignment and tire pressure are reasonable.` },
    { scenario: "Full-lock turning", risk: fullLockRisk, detail: "Full-lock steering is the main place this setup should be checked because offset and tire width stack closest to the liner and mud-flap area." },
    { scenario: "Off-road articulation", risk: articulationRisk, detail: trailWeighted ? "Your stated use case makes compression and articulation clearance a higher priority than street-only clearance." : "Articulation can still create contact even when street driving feels acceptable." }
  ];
}

function describeTrimNeeds(input: FitmentInput, report: FitmentReport) {
  if (!report.trimmingLikely) {
    return "No major trimming is predicted, but full-lock liner and mud-flap clearance should still be verified on the truck.";
  }

  if (report.bodyMountChopLikely) {
    return "Likely trim area: front inner liner, mud-flap pocket, pinch-weld area, and cab/body mount clearance. Severity: moderate to major depending on alignment and tire shape.";
  }

  if (input.liftHeight < 2.5) {
    return "Likely trim area: front inner liner and mud-flap pocket. Severity: light to moderate, with extra attention at full lock and compression.";
  }

  return "Likely trim area: front liner and mud-flap area. Severity: light, but tire brand and caster can move this up or down.";
}

function describeNotesInfluence(input: FitmentInput, report: FitmentReport) {
  const notes = input.buildGoals?.trim();
  if (!notes) return "No fitment notes were entered, so the premium reasoning weights the selected use case and rear-load fields most heavily.";

  const offRoadWeighted = /overland|trail|camp|off[- ]?road|rock|desert/i.test(notes);
  const comfortWeighted = /daily|comfort|commute|quiet|road/i.test(notes);
  if (offRoadWeighted) return `Your notes mention "${notes}", so articulation and loaded-travel clearance are weighted higher than street-only rubbing.`;
  if (comfortWeighted) return `Your notes mention "${notes}", so daily drivability and low-noise full-lock clearance are weighted higher than maximum tire stance.`;
  return `Your notes mention "${notes}", so the recommendation is framed around that goal instead of only the categorical ${report.rubbingRisk} rubbing-risk label.`;
}
