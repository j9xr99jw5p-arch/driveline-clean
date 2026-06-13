import type { FitmentInput, FitmentReport, FitmentRisk } from "./types";

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

function maxRisk(...risks: FitmentRisk[]): FitmentRisk {
  const rank = { low: 1, medium: 2, high: 3 };
  return risks.reduce((best, risk) => (rank[risk] > rank[best] ? risk : best), "low");
}

export function assessFitment(input: FitmentInput): FitmentReport {
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
